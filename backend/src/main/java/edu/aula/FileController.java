package edu.aula;

import java.util.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipInputStream;
import javax.imageio.ImageIO;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class FileController {
    final Db db;final Access a;
    public FileController(Db d,Access a){db=d;this.a=a;}
    @PostMapping("/courses/{id}/files") @Transactional Map<String,Object> upload(@PathVariable long id,@RequestParam String purpose,@RequestParam MultipartFile file) throws IOException {
        a.course(id,false);if(purpose.equals("SUBMISSION"))a.roles("STUDENT");else{a.course(id,true);if(!Set.of("RESOURCE","TASK").contains(purpose))AcademicController.bad("Finalidad no permitida.");}
        if(file.isEmpty()||file.getSize()>5242880)AcademicController.bad("Usa un archivo de hasta 5 MB.");
        // Serialize the per-user quota check to keep concurrent uploads inside the limit.
        db.one("SELECT id FROM app_user WHERE id=? FOR UPDATE",a.uid());
        long total=((Number)db.one("SELECT coalesce(sum(octet_length(content)),0) total FROM stored_file WHERE owner_id=?",a.uid()).get("total")).longValue();
        if(total+file.getSize()>104857600)throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Cuota de archivos de 100 MB alcanzada.");
        var name=Optional.ofNullable(file.getOriginalFilename()).orElse("archivo").replaceAll("[\\\\/\\r\\n\\p{Cntrl}]","_");
        if(name.length()>180)name=name.substring(name.length()-180);
        byte[] bytes=file.getBytes();String ext=name.substring(name.lastIndexOf('.')+1).toLowerCase(Locale.ROOT);String mime=detect(ext,bytes);
        if(file.getContentType()!=null&&!file.getContentType().equals(mime)&&!file.getContentType().equals("application/octet-stream"))AcademicController.bad("El tipo de contenido no coincide con el archivo.");
        UUID fid=UUID.randomUUID();db.update("INSERT INTO stored_file(id,course_id,owner_id,purpose,name,mime,content) VALUES (?,?,?,?,?,?,?)",fid,id,a.uid(),purpose,name,mime,bytes);return Map.of("id",fid,"name",name);
    }
    static String detect(String ext,byte[] b) throws IOException {
        if(ext.equals("pdf")&&b.length>5&&new String(b,0,5,StandardCharsets.US_ASCII).equals("%PDF-"))return "application/pdf";
        if(Set.of("jpg","jpeg","png").contains(ext)){
            boolean png=b.length>8&&b[0]==(byte)137&&b[1]==80&&b[2]==78&&b[3]==71;
            boolean jpg=b.length>3&&b[0]==(byte)255&&b[1]==(byte)216&&b[2]==(byte)255;
            if((ext.equals("png")&&png||!ext.equals("png")&&jpg)){
                try(var input=ImageIO.createImageInputStream(new ByteArrayInputStream(b))){var readers=ImageIO.getImageReaders(input);if(readers.hasNext()){var reader=readers.next();try{reader.setInput(input);if((long)reader.getWidth(0)*reader.getHeight(0)<=25000000)return png?"image/png":"image/jpeg";}finally{reader.dispose();}}}
            }
        }
        if(Set.of("docx","pptx").contains(ext)&&b.length>4&&b[0]==80&&b[1]==75){
            boolean types=false,doc=false;long expanded=0;int count=0;
            try(var z=new ZipInputStream(new ByteArrayInputStream(b))){java.util.zip.ZipEntry e;byte[] buffer=new byte[8192];while((e=z.getNextEntry())!=null){if(++count>1000)break;if(e.getName().equals("[Content_Types].xml"))types=true;if(e.getName().equals(ext.equals("docx")?"word/document.xml":"ppt/presentation.xml"))doc=true;if(e.getName().toLowerCase(Locale.ROOT).contains("vbaproject"))AcademicController.bad("Los documentos con macros no están permitidos.");int n;while((n=z.read(buffer))!=-1){expanded+=n;if(expanded>26214400)AcademicController.bad("El documento comprimido supera el límite seguro.");}}}
            if(types&&doc&&count<=1000)return ext.equals("docx")?"application/vnd.openxmlformats-officedocument.wordprocessingml.document":"application/vnd.openxmlformats-officedocument.presentationml.presentation";
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Archivo inválido. Formatos: PDF, DOCX, PPTX, JPG y PNG.");
    }
    @GetMapping("/files/{id}") ResponseEntity<byte[]> download(@PathVariable UUID id,@RequestParam(defaultValue="false") boolean preview){
        var f=db.one("SELECT id,course_id,owner_id,purpose,name,mime FROM stored_file WHERE id=?",id);a.course(Db.id(f,"course_id"),false);
        if(a.role().equals("STUDENT")){
            if(f.get("purpose").equals("SUBMISSION")){if(Db.id(f,"owner_id")!=a.uid())Access.deny();}
            else if(f.get("purpose").equals("TASK")){if(!db.exists("SELECT 1 FROM task_file x JOIN task t ON t.id=x.task_id WHERE x.file_id=? AND t.published_at<=now()",id))Access.deny();}
            else if(!db.exists("SELECT 1 FROM resource WHERE file_id=?",id))Access.deny();
        }
        if(preview&&!Set.of("application/pdf","image/png","image/jpeg").contains(f.get("mime")))AcademicController.bad("Este formato solo admite descarga.");
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,(preview?ContentDisposition.inline():ContentDisposition.attachment()).filename((String)f.get("name"),StandardCharsets.UTF_8).build().toString())
            .cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType((String)f.get("mime"))).body((byte[])db.one("SELECT content FROM stored_file WHERE id=?",id).get("content"));
    }
}
