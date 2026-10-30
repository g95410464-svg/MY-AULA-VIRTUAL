package edu.aula;

import java.time.LocalDate;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/calendar")
public class CalendarController {
    final Db db;final Access a;
    public CalendarController(Db db,Access a){this.db=db;this.a=a;}
    void bounds(LocalDate from,LocalDate to){if(to.isBefore(from)||to.isAfter(from.plusYears(1)))AcademicController.bad("Selecciona un intervalo máximo de un año.");}
    void staff(){a.roles("TEACHER","COORDINATOR","ADMIN");}
    public record Note(@NotNull LocalDate date,@NotBlank @Size(max=180) String title,@NotNull @Size(max=10000) String content){}
    @GetMapping("/annotations") List<Map<String,Object>> notes(@RequestParam LocalDate from,@RequestParam LocalDate to){staff();bounds(from,to);return db.list("SELECT * FROM calendar_annotation WHERE user_id=? AND on_date BETWEEN ? AND ? ORDER BY on_date,id",a.uid(),from,to);}
    @PostMapping("/annotations") @Transactional Map<String,Long> create(@RequestBody @Valid Note p){staff();return Map.of("id",db.insert("INSERT INTO calendar_annotation(user_id,on_date,title,content) VALUES (?,?,?,?)",a.uid(),p.date(),p.title(),p.content()));}
    @DeleteMapping("/annotations/{id}") @Transactional void remove(@PathVariable long id){staff();db.one("SELECT id FROM calendar_annotation WHERE id=? AND user_id=?",id,a.uid());db.update("DELETE FROM calendar_annotation WHERE id=? AND user_id=?",id,a.uid());}
    @GetMapping("/events") List<Map<String,Object>> events(@RequestParam LocalDate from,@RequestParam LocalDate to){bounds(from,to);return db.list("SELECT * FROM institutional_event WHERE on_date BETWEEN ? AND ? ORDER BY on_date,id",from,to);}
    @PostMapping("/events") @Transactional Map<String,Long> createEvent(@RequestBody @Valid Note p){a.roles("ADMIN");long id=db.insert("INSERT INTO institutional_event(author_id,on_date,title,content) VALUES (?,?,?,?)",a.uid(),p.date(),p.title(),p.content());db.update("INSERT INTO audit_log(actor_id,action,target) VALUES (?,'CREATE_EVENT',?)",a.uid(),Long.toString(id));return Map.of("id",id);}
    @DeleteMapping("/events/{id}") @Transactional void removeEvent(@PathVariable long id){a.roles("ADMIN");db.one("SELECT id FROM institutional_event WHERE id=?",id);db.update("DELETE FROM institutional_event WHERE id=?",id);db.update("INSERT INTO audit_log(actor_id,action,target) VALUES (?,'DELETE_EVENT',?)",a.uid(),Long.toString(id));}
}
