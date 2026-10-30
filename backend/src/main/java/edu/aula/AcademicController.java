package edu.aula;

import java.util.*;
import java.time.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class AcademicController {
    final Db db;final Access a;final PasswordEncoder encoder;
    public AcademicController(Db d,Access a,PasswordEncoder e){db=d;this.a=a;encoder=e;}
    void audit(String action,Object target){db.update("INSERT INTO audit_log(actor_id,action,target) VALUES (?,?,?)",a.uid(),action,String.valueOf(target));}
    static void bad(String s){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,s);}
    @GetMapping("/courses") List<Map<String,Object>> courses(){
        return db.list("SELECT c.*,s.name,s.color,g.name group_name,u.name teacher_name,p.name period_name,p.starts_on,p.ends_on FROM course c JOIN subject s ON s.id=c.subject_id JOIN study_group g ON g.id=c.group_id JOIN period p ON p.id=g.period_id JOIN app_user u ON u.id=c.teacher_id WHERE "+scope("c")+" ORDER BY s.name",a.uid());
    }
    String scope(String c){return a.role().equals("STUDENT") ? "EXISTS(SELECT 1 FROM enrollment z WHERE z.group_id="+c+".group_id AND z.student_id=?)" : (a.has("TEACHER") ? c+".teacher_id=?" : "? < 0");}
    @GetMapping("/catalog") Map<String,Object> catalog(){
        a.roles("ADMIN","COORDINATOR");boolean admin=a.role().equals("ADMIN");
        var result=new LinkedHashMap<String,Object>();
        for(String t:List.of("period","grade","section","subject"))result.put(t,db.list("SELECT * FROM "+t+" ORDER BY id"));
        result.put("groups",admin?db.list("SELECT * FROM study_group ORDER BY id"):db.list("SELECT g.*,s.can_manage FROM study_group g JOIN coordinator_scope s ON s.group_id=g.id WHERE s.user_id=?",a.uid()));
        String teacher="(u.role='TEACHER' OR (u.role IN ('ADMIN','COORDINATOR') AND (EXISTS(SELECT 1 FROM user_secondary_role r WHERE r.user_id=u.id) OR EXISTS(SELECT 1 FROM course c WHERE c.teacher_id=u.id))))";
        var people=admin?db.list("SELECT id,name,email,role,active,must_change_password FROM app_user ORDER BY id"):db.list("SELECT u.id,u.name,u.email,u.role,u.active FROM app_user u WHERE "+teacher+" OR (u.role='STUDENT' AND (NOT EXISTS(SELECT 1 FROM enrollment e WHERE e.student_id=u.id) OR EXISTS(SELECT 1 FROM enrollment e JOIN coordinator_scope s ON s.group_id=e.group_id WHERE e.student_id=u.id AND s.user_id=?))) ORDER BY u.name",a.uid());
        for(var person:people)person.put("roles",new RolePolicy(db).roles(Db.id(person,"id")));
        result.put("people",people);
        result.put("courses",db.list("SELECT c.*,s.name,s.color,g.name group_name,u.name teacher_name FROM course c JOIN subject s ON s.id=c.subject_id JOIN study_group g ON g.id=c.group_id JOIN app_user u ON u.id=c.teacher_id WHERE "+(admin?"? > 0":"EXISTS(SELECT 1 FROM coordinator_scope z WHERE z.user_id=? AND z.group_id=c.group_id)")+" ORDER BY s.name",a.uid()));
        result.put("enrollments",admin?db.list("SELECT * FROM enrollment"):db.list("SELECT e.* FROM enrollment e JOIN coordinator_scope s ON s.group_id=e.group_id WHERE s.user_id=?",a.uid()));
        result.put("scopes",admin?db.list("SELECT * FROM coordinator_scope"):List.of());return result;
    }
    public record CatalogInput(@NotBlank @Size(max=100) String name,@Pattern(regexp="#[0-9a-fA-F]{6}") String color,LocalDate startsOn,LocalDate endsOn){}
    @PostMapping("/catalog/{type}") @Transactional Map<String,Long> createCatalog(@PathVariable String type,@RequestBody @Valid CatalogInput p){
        a.roles("ADMIN");long id;
        switch(type){
            case "subject" -> id=db.insert("INSERT INTO subject(name,color) VALUES (?,?)",p.name(),p.color()==null?"#6d5ce7":p.color());
            case "grade","section" -> id=db.insert("INSERT INTO "+type+"(name) VALUES (?)",p.name());
            case "period" -> {if(p.startsOn()==null||p.endsOn()==null||p.endsOn().isBefore(p.startsOn()))bad("Fechas del período inválidas.");id=db.insert("INSERT INTO period(name,starts_on,ends_on) VALUES (?,?,?)",p.name(),p.startsOn(),p.endsOn());}
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        audit("CREATE_"+type,id);return Map.of("id",id);
    }
    @PutMapping("/catalog/{type}/{id}") @Transactional void editCatalog(@PathVariable String type,@PathVariable long id,@RequestBody @Valid CatalogInput p){
        a.roles("ADMIN");if(!Set.of("subject","grade","section","period").contains(type))bad("Catálogo desconocido.");
        db.one("SELECT id FROM "+type+" WHERE id=?",id);
        if(type.equals("period")){if(p.startsOn()==null||p.endsOn()==null||p.endsOn().isBefore(p.startsOn()))bad("Fechas inválidas.");db.update("UPDATE period SET name=?,starts_on=?,ends_on=? WHERE id=?",p.name(),p.startsOn(),p.endsOn(),id);}
        else if(type.equals("subject"))db.update("UPDATE subject SET name=?,color=? WHERE id=?",p.name(),p.color()==null?"#6d5ce7":p.color(),id);
        else db.update("UPDATE "+type+" SET name=? WHERE id=?",p.name(),id);audit("EDIT_"+type,id);
    }
    public record GroupInput(@NotBlank @Size(max=100) String name,@Positive long periodId,@Positive long gradeId,@Positive long sectionId){}
    @PostMapping("/groups") @Transactional Map<String,Long> group(@RequestBody @Valid GroupInput p){
        a.roles("ADMIN");long id=db.insert("INSERT INTO study_group(name,period_id,grade_id,section_id) VALUES (?,?,?,?)",p.name(),p.periodId(),p.gradeId(),p.sectionId());audit("CREATE_GROUP",id);return Map.of("id",id);
    }
    public record Enrollment(@Positive long studentId){}
    @PostMapping("/groups/{id}/enrollments") @Transactional void enroll(@PathVariable long id,@RequestBody @Valid Enrollment p){a.enrollmentGroup(id);a.userRole(p.studentId(),"STUDENT");a.studentEnrollment(p.studentId());db.one("SELECT id FROM app_user WHERE id=? FOR UPDATE",p.studentId());db.update("INSERT INTO enrollment(student_id,group_id) VALUES (?,?) ON CONFLICT DO NOTHING",p.studentId(),id);audit("ENROLL",id+":"+p.studentId());}
    @DeleteMapping("/groups/{id}/enrollments/{student}") @Transactional void unenroll(@PathVariable long id,@PathVariable long student){a.enrollmentGroup(id);db.update("DELETE FROM enrollment WHERE group_id=? AND student_id=?",id,student);audit("UNENROLL",id+":"+student);}
    public record ScopeInput(@Positive long userId,boolean canManage){}
    @PostMapping("/groups/{id}/coordinators") @Transactional void coordinator(@PathVariable long id,@RequestBody @Valid ScopeInput p){a.roles("ADMIN");a.userRole(p.userId(),"COORDINATOR");db.update("INSERT INTO coordinator_scope(user_id,group_id,can_manage) VALUES (?,?,?) ON CONFLICT(user_id,group_id) DO UPDATE SET can_manage=excluded.can_manage",p.userId(),id,p.canManage());audit("ASSIGN_COORDINATOR",id+":"+p.userId());}
    @DeleteMapping("/groups/{id}/coordinators/{user}") @Transactional void uncoordinator(@PathVariable long id,@PathVariable long user){a.roles("ADMIN");db.update("DELETE FROM coordinator_scope WHERE group_id=? AND user_id=?",id,user);audit("REMOVE_COORDINATOR",id+":"+user);}
    public record CourseInput(@Positive long subjectId,@Positive long groupId,@Positive long teacherId){}
    @PostMapping("/courses") @Transactional Map<String,Long> course(@RequestBody @Valid CourseInput p){a.group(p.groupId(),true);a.userRole(p.teacherId(),"TEACHER");long id=db.insert("INSERT INTO course(subject_id,group_id,teacher_id) VALUES (?,?,?)",p.subjectId(),p.groupId(),p.teacherId());audit("CREATE_COURSE",id);return Map.of("id",id);}
    public record TeacherInput(@Positive long teacherId){}
    @PutMapping("/courses/{id}/teacher") @Transactional void teacher(@PathVariable long id,@RequestBody @Valid TeacherInput p){
        var c=db.one("SELECT * FROM course WHERE id=? FOR UPDATE",id);a.group(Db.id(c,"group_id"),true);a.userRole(p.teacherId(),"TEACHER");
        db.list("SELECT id FROM app_user WHERE id IN (?,?) ORDER BY id FOR UPDATE",c.get("teacher_id"),p.teacherId());
        if(db.exists("SELECT 1 FROM schedule x JOIN schedule y ON x.weekday=y.weekday AND x.starts_at<y.ends_at AND x.ends_at>y.starts_at JOIN course c ON c.id=y.course_id WHERE x.course_id=? AND y.course_id<>? AND c.teacher_id=?",id,id,p.teacherId()))bad("El docente tiene un conflicto de horario.");
        if(db.exists("SELECT 1 FROM schedule x JOIN schedule_break b ON b.weekday=x.weekday AND b.starts_at<x.ends_at AND b.ends_at>x.starts_at WHERE x.course_id=? AND b.teacher_id=?",id,p.teacherId()))bad("La asignación coincide con un receso del docente.");
        db.update("UPDATE course SET teacher_id=? WHERE id=?",p.teacherId(),id);audit("ASSIGN_TEACHER",id);
    }
    public record NewUser(@NotBlank @Size(max=120) String name,@Email @NotBlank @Size(max=200) String email,@Pattern(regexp="STUDENT|TEACHER|COORDINATOR|ADMIN") @NotNull String role,@NotNull @Size(min=12,max=72) String password){}
    @PostMapping("/users") @Transactional Map<String,Long> user(@RequestBody @Valid NewUser p){a.roles("ADMIN");long id=db.insert("INSERT INTO app_user(name,email,role,password_hash,must_change_password) VALUES (?,?,?,?,true)",p.name(),p.email().toLowerCase(Locale.ROOT),p.role(),encoder.encode(p.password()));audit("CREATE_USER",id);return Map.of("id",id);}
    public record EditUser(@NotBlank @Size(max=120) String name,@Email @NotBlank @Size(max=200) String email,@Pattern(regexp="STUDENT|TEACHER|COORDINATOR|ADMIN") @NotNull String role,boolean active){}
    @PutMapping("/users/{id}") @Transactional void editUser(@PathVariable long id,@RequestBody @Valid EditUser p){
        a.roles("ADMIN");long actorId=a.uid();db.list("SELECT id FROM app_user WHERE role='ADMIN' ORDER BY id FOR UPDATE");var u=db.one("SELECT * FROM app_user WHERE id=? FOR UPDATE",id);
        if(id==actorId&&(!p.active()||!p.role().equals("ADMIN")))bad("No puedes retirar tu propio acceso administrativo.");
        if(!p.role().equals(u.get("role"))&&(db.exists("SELECT 1 FROM enrollment WHERE student_id=?",id)||db.exists("SELECT 1 FROM course WHERE teacher_id=?",id)||db.exists("SELECT 1 FROM coordinator_scope WHERE user_id=?",id)||db.exists("SELECT 1 FROM submission WHERE student_id=?",id)))bad("Retira las asignaciones antes de cambiar el rol; los alumnos con entregas conservan su rol histórico.");
        if(!p.role().equals("ADMIN")&&!p.role().equals("COORDINATOR"))db.update("DELETE FROM user_secondary_role WHERE user_id=?",id);
        db.update("UPDATE app_user SET name=?,email=?,role=?,active=?,auth_version=auth_version+1 WHERE id=?",p.name(),p.email().toLowerCase(Locale.ROOT),p.role(),p.active(),id);
        db.update("INSERT INTO audit_log(actor_id,action,target) VALUES (?,'EDIT_USER',?)",actorId,Long.toString(id));
    }
    public record Reset(@NotNull @Size(min=12,max=72) String password){}
    @PostMapping("/users/{id}/reset") @Transactional void reset(@PathVariable long id,@RequestBody @Valid Reset p){a.roles("ADMIN");db.one("SELECT id FROM app_user WHERE id=?",id);if(id==a.uid())bad("Utiliza el cambio de contraseña de tu cuenta.");db.update("UPDATE app_user SET password_hash=?,must_change_password=true,auth_version=auth_version+1 WHERE id=?",encoder.encode(p.password()),id);audit("RESET_PASSWORD",id);}
    @GetMapping("/audit") List<Map<String,Object>> audit(){a.roles("ADMIN");return db.list("SELECT x.id,x.action,x.target,x.created_at,u.name actor_name FROM audit_log x LEFT JOIN app_user u ON u.id=x.actor_id ORDER BY x.id DESC LIMIT 200");}
}
