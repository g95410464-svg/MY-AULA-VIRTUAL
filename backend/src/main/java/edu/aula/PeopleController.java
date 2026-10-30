package edu.aula;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;

@RestController
@RequestMapping("/api")
public class PeopleController {
    final Db db;final Access a;final PasswordEncoder encoder;
    public PeopleController(Db db,Access a,PasswordEncoder encoder){this.db=db;this.a=a;this.encoder=encoder;}
    void audit(String action,long id){db.update("INSERT INTO audit_log(actor_id,action,target) VALUES (?,?,?)",a.uid(),action,Long.toString(id));}
    public record StudentInput(@NotBlank @Size(max=120) String name,@Email @NotBlank @Size(max=200) String email,@NotNull @Size(min=12,max=72) String password,@Positive long groupId){}
    @PostMapping("/academic/students") @Transactional Map<String,Long> student(@RequestBody @Valid StudentInput p){
        a.enrollmentGroup(p.groupId());
        long id=db.insert("INSERT INTO app_user(name,email,password_hash,role,must_change_password) VALUES (?,?,?,'STUDENT',true)",p.name(),p.email().toLowerCase(Locale.ROOT),encoder.encode(p.password()));
        db.update("INSERT INTO enrollment(student_id,group_id) VALUES (?,?)",id,p.groupId());audit("CREATE_ENROLLED_STUDENT",id);return Map.of("id",id);
    }
    @GetMapping("/teachers") List<Map<String,Object>> teachers(){
        a.roles("ADMIN","COORDINATOR");
        var rows=db.list("SELECT u.id,u.name,u.email,u.role,u.active FROM app_user u WHERE u.role='TEACHER' OR (u.role IN ('ADMIN','COORDINATOR') AND (EXISTS(SELECT 1 FROM user_secondary_role r WHERE r.user_id=u.id) OR EXISTS(SELECT 1 FROM course c WHERE c.teacher_id=u.id))) ORDER BY u.name");
        for(var row:rows)row.put("roles",new RolePolicy(db).roles(Db.id(row,"id")));return rows;
    }
    public record TeacherCreate(@NotBlank @Size(max=120) String name,@Email @NotBlank @Size(max=200) String email,@NotNull @Size(min=12,max=72) String password){}
    @PostMapping("/teachers") @Transactional Map<String,Long> create(@RequestBody @Valid TeacherCreate p){
        a.roles("ADMIN");long id=db.insert("INSERT INTO app_user(name,email,password_hash,role,must_change_password) VALUES (?,?,?,'TEACHER',true)",p.name(),p.email().toLowerCase(Locale.ROOT),encoder.encode(p.password()));audit("CREATE_TEACHER",id);return Map.of("id",id);
    }
    public record TeacherEdit(@NotBlank @Size(max=120) String name,@Email @NotBlank @Size(max=200) String email,boolean active){}
    @GetMapping("/teachers/{id}") Map<String,Object> teacher(@PathVariable long id){a.roles("ADMIN");if(!new RolePolicy(db).roles(id).contains("TEACHER"))Access.deny();return db.one("SELECT id,name,email,role,active FROM app_user WHERE id=?",id);}
    @PutMapping("/teachers/{id}") @Transactional void edit(@PathVariable long id,@RequestBody @Valid TeacherEdit p){
        a.roles("ADMIN");db.one("SELECT id FROM app_user WHERE id=? FOR UPDATE",id);var u=teacher(id);
        if(!p.active()&&!u.get("role").equals("TEACHER"))AcademicController.bad("Esta cuenta tiene otro rol. Administra su acceso desde Usuarios.");
        db.update("UPDATE app_user SET name=?,email=?,active=?,auth_version=auth_version+1 WHERE id=?",p.name(),p.email().toLowerCase(Locale.ROOT),p.active(),id);audit("EDIT_TEACHER",id);
    }
    @DeleteMapping("/teachers/{id}") @Transactional void deactivate(@PathVariable long id){
        a.roles("ADMIN");db.one("SELECT id FROM app_user WHERE id=? FOR UPDATE",id);var u=teacher(id);
        if(!u.get("role").equals("TEACHER"))AcademicController.bad("Esta cuenta tiene otro rol. Administra su acceso desde Usuarios.");
        db.update("UPDATE app_user SET active=false,auth_version=auth_version+1 WHERE id=?",id);audit("DEACTIVATE_TEACHER",id);
    }
    public record RolesInput(@NotNull Set<@Pattern(regexp="ADMIN|COORDINATOR|TEACHER|STUDENT") String> roles){}
    @PutMapping("/users/{id}/roles") @Transactional void roles(@PathVariable long id,@RequestBody @Valid RolesInput p){
        a.roles("ADMIN");var u=db.one("SELECT role FROM app_user WHERE id=? FOR UPDATE",id);String primary=(String)u.get("role");
        var allowed=new HashSet<>(Set.of(primary));if(Set.of("ADMIN","COORDINATOR").contains(primary))allowed.add("TEACHER");
        if(!p.roles().contains(primary)||!allowed.containsAll(p.roles()))AcademicController.bad("Conserva el rol principal; solo administradores y coordinadores pueden añadir el rol Maestro.");
        if(!p.roles().contains("TEACHER")&&db.exists("SELECT 1 FROM course WHERE teacher_id=?",id))AcademicController.bad("Reasigna sus materias antes de retirar el rol Maestro.");
        db.update("DELETE FROM user_secondary_role WHERE user_id=?",id);
        if(p.roles().contains("TEACHER")&&!primary.equals("TEACHER"))db.update("INSERT INTO user_secondary_role(user_id,role) VALUES (?,'TEACHER')",id);
        db.update("UPDATE app_user SET auth_version=auth_version+1 WHERE id=?",id);audit("EDIT_ROLES",id);
    }
}
