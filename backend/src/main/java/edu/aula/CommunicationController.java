package edu.aula;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api")
public class CommunicationController {
    final Db db;final Access a;
    public CommunicationController(Db d,Access a){db=d;this.a=a;}
    @GetMapping("/courses/{id}/messages") List<Map<String,Object>> messages(@PathVariable long id,@RequestParam(defaultValue="0") long after){
        a.course(id,false);var rows=db.list("SELECT m.id,m.sender_id,m.body,m.created_at,u.name sender_name,u.role sender_role FROM message m JOIN app_user u ON u.id=m.sender_id WHERE m.course_id=? AND m.id>? ORDER BY m.id "+(after==0?"DESC":"ASC")+" LIMIT 100",id,after);if(after==0)Collections.reverse(rows);return rows;
    }
    public record MessageInput(@NotBlank @Size(max=3000) String body){}
    @PostMapping("/courses/{id}/messages") @Transactional Map<String,Long> message(@PathVariable long id,@RequestBody @Valid MessageInput p){
        a.course(id,false);long mid=db.insert("INSERT INTO message(course_id,sender_id,body) VALUES (?,?,?)",id,a.uid(),p.body());
        db.update("INSERT INTO notification(user_id,title,course_id) SELECT x.uid,?,? FROM (SELECT e.student_id uid FROM enrollment e JOIN course c ON c.group_id=e.group_id WHERE c.id=? UNION SELECT teacher_id FROM course WHERE id=?) x JOIN app_user u ON u.id=x.uid WHERE x.uid<>? AND u.active=true","Mensaje nuevo en el chat",id,id,id,a.uid());return Map.of("id",mid);
    }
    @GetMapping("/notices") List<Map<String,Object>> notices(){
        String predicate=switch(a.role()){case "ADMIN"->"? > 0";case "TEACHER"->"EXISTS(SELECT 1 FROM course c WHERE c.group_id=n.group_id AND c.teacher_id=?)";case "COORDINATOR"->"EXISTS(SELECT 1 FROM coordinator_scope s WHERE s.group_id=n.group_id AND s.user_id=?)";default->"EXISTS(SELECT 1 FROM enrollment e WHERE e.group_id=n.group_id AND e.student_id=?)";};
        return db.list("SELECT n.*,u.name author_name,g.name group_name FROM notice n JOIN app_user u ON u.id=n.author_id JOIN study_group g ON g.id=n.group_id WHERE "+predicate+" ORDER BY n.id DESC LIMIT 100",a.uid());
    }
    public record NoticeInput(@Positive long groupId,@NotBlank @Size(max=180) String title,@NotBlank @Size(max=20000) String body){}
    @PostMapping("/notices") @Transactional Map<String,Long> notice(@RequestBody @Valid NoticeInput p){a.roles("ADMIN","COORDINATOR");a.group(p.groupId(),false);long id=db.insert("INSERT INTO notice(group_id,author_id,title,body) VALUES (?,?,?,?)",p.groupId(),a.uid(),p.title(),p.body());db.update("INSERT INTO notification(user_id,title) SELECT student_id,? FROM enrollment WHERE group_id=?","Aviso: "+p.title(),p.groupId());return Map.of("id",id);}
    @GetMapping("/notifications") List<Map<String,Object>> notifications(){return db.list("SELECT * FROM notification WHERE user_id=? ORDER BY id DESC LIMIT 100",a.uid());}
    @PostMapping("/notifications/{id}/read") void read(@PathVariable long id){db.update("UPDATE notification SET read_at=now() WHERE id=? AND user_id=?",id,a.uid());}
}
