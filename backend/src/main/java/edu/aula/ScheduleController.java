package edu.aula;

import java.time.LocalTime;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api")
public class ScheduleController {
    final Db db;final Access a;
    public ScheduleController(Db db,Access a){this.db=db;this.a=a;}
    void teacher(long id,boolean manage){
        a.userRole(id,"TEACHER");
        if(a.has("ADMIN"))return;
        if(a.has("COORDINATOR")&&db.exists("SELECT 1 FROM course c JOIN coordinator_scope z ON z.group_id=c.group_id WHERE c.teacher_id=? AND z.user_id=?"+(manage?" AND z.can_manage=true":""),id,a.uid()))return;
        if(!manage&&a.has("TEACHER")&&id==a.uid())return;
        Access.deny();
    }
    String predicate(Long teacherId){
        if(teacherId!=null){teacher(teacherId,false);return "c.teacher_id=? AND (? OR EXISTS(SELECT 1 FROM coordinator_scope z WHERE z.group_id=c.group_id AND z.user_id=?))";}
        if(a.has("ADMIN"))return "? < 0";
        if(a.role().equals("STUDENT"))return "EXISTS(SELECT 1 FROM enrollment e WHERE e.group_id=c.group_id AND e.student_id=?)";
        return a.has("TEACHER")?"c.teacher_id=?":"? < 0";
    }
    @GetMapping("/schedules") List<Map<String,Object>> schedules(@RequestParam(required=false) Long teacherId){
        return db.list("SELECT x.*,c.teacher_id,s.name subject_name,g.name group_name,u.name teacher_name FROM schedule x JOIN course c ON c.id=x.course_id JOIN subject s ON s.id=c.subject_id JOIN study_group g ON g.id=c.group_id JOIN app_user u ON u.id=c.teacher_id WHERE "+predicate(teacherId)+" ORDER BY weekday,starts_at",(teacherId==null?new Object[]{a.uid()}:new Object[]{teacherId,a.has("ADMIN")||teacherId==a.uid(),a.uid()}));
    }
    public record Block(@Positive long courseId,@Min(1) @Max(7) int weekday,@NotNull LocalTime startsAt,@NotNull LocalTime endsAt,@NotNull @Pattern(regexp="PRESENCIAL|VIRTUAL|HIBRIDA") String modality,@Size(max=2000) String url){}
    void range(LocalTime start,LocalTime end){if(!end.isAfter(start))AcademicController.bad("La hora final debe ser posterior.");}
    void lockTeacher(long id){db.one("SELECT id FROM app_user WHERE id=? FOR UPDATE",id);}
    void conflict(long exclude,long teacher,long group,int day,LocalTime start,LocalTime end){
        if(db.exists("SELECT 1 FROM schedule x JOIN course c ON c.id=x.course_id WHERE x.id<>? AND x.weekday=? AND x.starts_at<? AND x.ends_at>? AND (c.teacher_id=? OR c.group_id=?)",exclude,day,end,start,teacher,group)||db.exists("SELECT 1 FROM schedule_break WHERE teacher_id=? AND weekday=? AND starts_at<? AND ends_at>?",teacher,day,end,start))AcademicController.bad("El horario se solapa con una clase o un receso del docente o grupo.");
    }
    void audit(String action,long id){db.update("INSERT INTO audit_log(actor_id,action,target) VALUES (?,?,?)",a.uid(),action,Long.toString(id));}
    Map<String,Object> validate(Block p,long exclude){
        var c=db.one("SELECT * FROM course WHERE id=? FOR UPDATE",p.courseId());a.group(Db.id(c,"group_id"),true);a.userRole(Db.id(c,"teacher_id"),"TEACHER");range(p.startsAt(),p.endsAt());LearningController.url(p.url());
        lockTeacher(Db.id(c,"teacher_id"));db.one("SELECT id FROM study_group WHERE id=? FOR UPDATE",c.get("group_id"));
        conflict(exclude,Db.id(c,"teacher_id"),Db.id(c,"group_id"),p.weekday(),p.startsAt(),p.endsAt());return c;
    }
    @PostMapping("/schedules") @Transactional Map<String,Long> create(@RequestBody @Valid Block p){
        validate(p,0);long id=db.insert("INSERT INTO schedule(course_id,weekday,starts_at,ends_at,modality,url) VALUES (?,?,?,?,?,?)",p.courseId(),p.weekday(),p.startsAt(),p.endsAt(),p.modality(),LearningController.blank(p.url()));audit("CREATE_SCHEDULE",id);return Map.of("id",id);
    }
    @PutMapping("/schedules/{id}") @Transactional void edit(@PathVariable long id,@RequestBody @Valid Block p){
        var existing=db.one("SELECT course_id FROM schedule WHERE id=?",id);if(Db.id(existing,"course_id")!=p.courseId())AcademicController.bad("El bloque debe conservar su asignatura; elimina y crea otro para reasignarlo.");
        validate(p,id);if(db.update("UPDATE schedule SET weekday=?,starts_at=?,ends_at=?,modality=?,url=? WHERE id=? AND course_id=?",p.weekday(),p.startsAt(),p.endsAt(),p.modality(),LearningController.blank(p.url()),id,p.courseId())==0)db.one("SELECT id FROM schedule WHERE id=?",id);audit("EDIT_SCHEDULE",id);
    }
    @DeleteMapping("/schedules/{id}") @Transactional void delete(@PathVariable long id){var c=db.one("SELECT c.id,c.group_id FROM course c JOIN schedule x ON x.course_id=c.id WHERE x.id=? FOR UPDATE OF c",id);a.group(Db.id(c,"group_id"),true);db.update("DELETE FROM schedule WHERE id=?",id);audit("DELETE_SCHEDULE",id);}
    @GetMapping("/schedule-breaks") List<Map<String,Object>> breaks(@RequestParam(required=false) Long teacherId){
        if(teacherId==null){if(!a.has("TEACHER")||a.has("ADMIN"))return List.of();teacherId=a.uid();}
        teacher(teacherId,false);return db.list("SELECT * FROM schedule_break WHERE teacher_id=? ORDER BY weekday,starts_at",teacherId);
    }
    public record BreakInput(@Positive long teacherId,@Min(1) @Max(7) int weekday,@NotNull LocalTime startsAt,@NotNull LocalTime endsAt,@NotBlank @Size(max=100) String title){}
    @PostMapping("/schedule-breaks") @Transactional Map<String,Long> createBreak(@RequestBody @Valid BreakInput p){
        teacher(p.teacherId(),true);range(p.startsAt(),p.endsAt());lockTeacher(p.teacherId());
        conflict(0,p.teacherId(),0,p.weekday(),p.startsAt(),p.endsAt());
        long id=db.insert("INSERT INTO schedule_break(teacher_id,weekday,starts_at,ends_at,title) VALUES (?,?,?,?,?)",p.teacherId(),p.weekday(),p.startsAt(),p.endsAt(),p.title());audit("CREATE_BREAK",id);return Map.of("id",id);
    }
    @DeleteMapping("/schedule-breaks/{id}") @Transactional void deleteBreak(@PathVariable long id){var b=db.one("SELECT * FROM schedule_break WHERE id=?",id);teacher(Db.id(b,"teacher_id"),true);lockTeacher(Db.id(b,"teacher_id"));db.update("DELETE FROM schedule_break WHERE id=?",id);audit("DELETE_BREAK",id);}
}
