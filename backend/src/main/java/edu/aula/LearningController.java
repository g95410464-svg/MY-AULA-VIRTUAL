package edu.aula;

import java.util.*;
import java.time.*;
import java.net.URI;
import java.math.BigDecimal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class LearningController {
    final Db db;final Access a;
    public LearningController(Db d,Access a){db=d;this.a=a;}
    public static String blank(String s){return s==null||s.isBlank()?null:s.trim();}
    public static void url(String value){if(blank(value)==null)return;try{var u=URI.create(value);if(!Set.of("https","http").contains(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null)throw new IllegalArgumentException();}catch(Exception e){AcademicController.bad("Usa un enlace HTTP o HTTPS válido.");}}
    Map<String,Object> task(long id,boolean teach){var t=db.one("SELECT * FROM task WHERE id=?",id);a.course(Db.id(t,"course_id"),teach);if(a.role().equals("STUDENT")&&((java.sql.Timestamp)t.get("published_at")).toInstant().isAfter(Instant.now()))Access.deny();return t;}
    void file(UUID id,long course,String purpose){if(id!=null&&!db.exists("SELECT 1 FROM stored_file WHERE id=? AND course_id=? AND owner_id=? AND purpose=?",id,course,a.uid(),purpose))Access.deny();}
    @GetMapping("/courses/{id}/tasks") List<Map<String,Object>> tasks(@PathVariable long id){a.course(id,false);return db.list("SELECT t.*,s.id submission_id,s.submitted_at,s.score,s.feedback,s.url submission_url,s.file_id submission_file,(SELECT count(*) FROM submission z WHERE z.task_id=t.id) submission_count FROM task t LEFT JOIN submission s ON s.task_id=t.id AND s.student_id=? WHERE t.course_id=?"+(a.role().equals("STUDENT")?" AND t.published_at<=now()":"")+" ORDER BY t.due_at",a.uid(),id);}
    public record TaskInput(@NotBlank @Size(max=180) String title,@NotBlank @Size(max=20000) String description,@NotNull OffsetDateTime dueAt,@NotNull OffsetDateTime publishedAt,@NotNull @Pattern(regexp="FILE|LINK|BOTH") String deliveryType,@NotNull @DecimalMin("0.01") @DecimalMax("1000") BigDecimal maxScore,UUID fileId){}
    @PostMapping("/courses/{id}/tasks") @Transactional Map<String,Long> createTask(@PathVariable long id,@RequestBody @Valid TaskInput p){
        a.course(id,true);if(!p.dueAt().isAfter(p.publishedAt())||!p.dueAt().isAfter(OffsetDateTime.now()))AcademicController.bad("La entrega debe ser posterior a la publicación y a la hora actual.");file(p.fileId(),id,"TASK");
        long tid=db.insert("INSERT INTO task(course_id,title,description,due_at,published_at,delivery_type,max_score) VALUES (?,?,?,?,?,?,?)",id,p.title(),p.description(),p.dueAt(),p.publishedAt(),p.deliveryType(),p.maxScore());
        if(p.fileId()!=null)db.update("INSERT INTO task_file(task_id,file_id) VALUES (?,?)",tid,p.fileId());
        if(!p.publishedAt().isAfter(OffsetDateTime.now())){notifyCourse(id,"Nueva tarea: "+p.title());db.update("UPDATE task SET notification_sent=true WHERE id=?",tid);}return Map.of("id",tid);
    }
    @GetMapping("/tasks/{id}/files") List<Map<String,Object>> taskFiles(@PathVariable long id){task(id,false);return db.list("SELECT f.id,f.name FROM task_file x JOIN stored_file f ON f.id=x.file_id WHERE x.task_id=?",id);}
    public record Submit(UUID fileId,@Size(max=2000) String url){}
    @PostMapping("/tasks/{id}/submission") @Transactional Map<String,Long> submit(@PathVariable long id,@RequestBody @Valid Submit p){
        a.roles("STUDENT");db.one("SELECT id FROM task WHERE id=? FOR UPDATE",id);var t=task(id,false);long course=Db.id(t,"course_id");
        if(((java.sql.Timestamp)t.get("due_at")).toInstant().isBefore(Instant.now()))AcademicController.bad("La fecha de entrega ha vencido.");
        var link=blank(p.url());url(link);var type=(String)t.get("delivery_type");
        if(p.fileId()==null&&link==null)AcademicController.bad("Adjunta un archivo o un enlace.");
        if(type.equals("FILE")&&(p.fileId()==null||link!=null)||type.equals("LINK")&&(link==null||p.fileId()!=null))AcademicController.bad("El tipo de entrega no está permitido.");
        file(p.fileId(),course,"SUBMISSION");
        if(db.exists("SELECT 1 FROM submission WHERE task_id=? AND student_id=? AND graded_at IS NOT NULL",id,a.uid()))AcademicController.bad("La entrega ya fue calificada.");
        long sid=db.insert("INSERT INTO submission(task_id,student_id,file_id,url) VALUES (?,?,?,?) ON CONFLICT(task_id,student_id) DO UPDATE SET file_id=excluded.file_id,url=excluded.url,submitted_at=now()",id,a.uid(),p.fileId(),link);
        db.update("INSERT INTO notification(user_id,title,course_id) SELECT teacher_id,?,id FROM course WHERE id=?","Nueva entrega: "+t.get("title"),course);return Map.of("id",sid);
    }
    @GetMapping("/tasks/{id}/submissions") List<Map<String,Object>> submissions(@PathVariable long id){
        var t=task(id,true);
        return db.list("SELECT u.id student_id,u.name student_name,s.id,s.id submission_id,s.file_id,f.name file_name,f.mime file_mime,s.url,s.submitted_at,s.score,s.feedback,s.graded_at FROM app_user u LEFT JOIN submission s ON s.student_id=u.id AND s.task_id=? LEFT JOIN stored_file f ON f.id=s.file_id AND f.course_id=? AND f.owner_id=u.id AND f.purpose='SUBMISSION' WHERE EXISTS(SELECT 1 FROM enrollment e JOIN course c ON c.group_id=e.group_id WHERE c.id=? AND e.student_id=u.id) OR s.id IS NOT NULL ORDER BY u.name",id,t.get("course_id"),t.get("course_id"));
    }
    @GetMapping("/submissions/{id}") Map<String,Object> submission(@PathVariable long id){
        var row=db.one("SELECT s.*,u.name student_name,t.title task_title,t.course_id,t.max_score,f.name file_name,f.mime file_mime FROM submission s JOIN app_user u ON u.id=s.student_id JOIN task t ON t.id=s.task_id LEFT JOIN stored_file f ON f.id=s.file_id AND f.course_id=t.course_id AND f.owner_id=s.student_id AND f.purpose='SUBMISSION' WHERE s.id=?",id);
        if(a.role().equals("STUDENT")){if(Db.id(row,"student_id")!=a.uid())Access.deny();a.course(Db.id(row,"course_id"),false);}else a.course(Db.id(row,"course_id"),true);
        return row;
    }
    public record GradeInput(@NotNull @DecimalMin("0") BigDecimal score,@NotNull @Size(max=10000) String feedback){}
    @PutMapping("/submissions/{id}/grade") @Transactional void grade(@PathVariable long id,@RequestBody @Valid GradeInput p){
        var s=db.one("SELECT * FROM submission WHERE id=? FOR UPDATE",id);var t=task(Db.id(s,"task_id"),true);
        if(p.score().compareTo((BigDecimal)t.get("max_score"))>0)AcademicController.bad("La nota supera el máximo de la tarea.");
        db.update("UPDATE submission SET score=?,feedback=?,graded_at=now() WHERE id=?",p.score(),p.feedback(),id);
        db.update("INSERT INTO notification(user_id,title,course_id) VALUES (?,?,?)",s.get("student_id"),"Tu entrega fue calificada: "+t.get("title"),t.get("course_id"));
        db.update("INSERT INTO audit_log(actor_id,action,target) VALUES (?,'GRADE',?)",a.uid(),Long.toString(id));
    }
    @GetMapping("/courses/{id}/resources") List<Map<String,Object>> resources(@PathVariable long id){a.course(id,false);return db.list("SELECT r.*,f.name file_name FROM resource r LEFT JOIN stored_file f ON f.id=r.file_id WHERE r.course_id=? ORDER BY r.id DESC",id);}
    public record ResourceInput(@NotBlank @Size(max=180) String title,@NotBlank @Size(max=100) String unit,@NotNull @Size(max=20000) String body,@Size(max=2000) String url,UUID fileId){}
    @PostMapping("/courses/{id}/resources") @Transactional Map<String,Long> resource(@PathVariable long id,@RequestBody @Valid ResourceInput p){a.course(id,true);url(p.url());file(p.fileId(),id,"RESOURCE");long rid=db.insert("INSERT INTO resource(course_id,title,unit,body,url,file_id) VALUES (?,?,?,?,?,?)",id,p.title(),p.unit(),p.body(),blank(p.url()),p.fileId());notifyCourse(id,"Nuevo material: "+p.title());return Map.of("id",rid);}
    void notifyCourse(long course,String title){db.update("INSERT INTO notification(user_id,title,course_id) SELECT student_id,?,? FROM enrollment e JOIN course c ON c.group_id=e.group_id WHERE c.id=?",title,course,course);}
    @GetMapping("/reports") List<Map<String,Object>> reports(){
        a.roles("TEACHER");String scope=new AcademicController(db,a,null).scope("c");
        return db.list("SELECT c.id,s.name,g.name group_name,(SELECT count(*) FROM enrollment e WHERE e.group_id=c.group_id) students,(SELECT count(*) FROM task t WHERE t.course_id=c.id) tasks,(SELECT count(*) FROM submission z JOIN task t ON t.id=z.task_id WHERE t.course_id=c.id) submissions,(SELECT count(*) FROM submission z JOIN task t ON t.id=z.task_id WHERE t.course_id=c.id AND z.graded_at IS NOT NULL) graded FROM course c JOIN subject s ON s.id=c.subject_id JOIN study_group g ON g.id=c.group_id WHERE "+scope+" ORDER BY s.name",a.uid());
    }
}
