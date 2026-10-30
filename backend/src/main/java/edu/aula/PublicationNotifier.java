package edu.aula;

import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@EnableScheduling
public class PublicationNotifier {
    private final Db db;
    public PublicationNotifier(Db db){this.db=db;}
    @Scheduled(fixedDelay=30000,initialDelay=30000)
    @Transactional
    public void publish(){
        for(var task:db.list("SELECT id,course_id,title FROM task WHERE published_at<=now() AND notification_sent=false ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED")){
            db.update("INSERT INTO notification(user_id,title,course_id) SELECT e.student_id,?,? FROM enrollment e JOIN course c ON c.group_id=e.group_id WHERE c.id=?","Nueva tarea: "+task.get("title"),task.get("course_id"),task.get("course_id"));
            db.update("UPDATE task SET notification_sent=true WHERE id=?",task.get("id"));
        }
    }
}
