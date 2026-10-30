package edu.aula;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class Access {
    private final Db db;
    public Access(Db db) {this.db=db;}
    public Map<String,Object> me() {var u=db.one("SELECT id,name,email,role,active,must_change_password FROM app_user WHERE email=?",SecurityContextHolder.getContext().getAuthentication().getName());u.put("roles",new RolePolicy(db).roles(Db.id(u,"id")));return u;}
    public long uid() {return Db.id(me(),"id");}
    public String role() {return (String)me().get("role");}
    public boolean has(String role) {return new RolePolicy(db).roles(uid()).contains(role);}
    public void roles(String... roles) {if(Arrays.stream(roles).noneMatch(this::has)) deny();}
    public void enrollmentGroup(long id) {roles("ADMIN","COORDINATOR");group(id,false);}
    public void studentEnrollment(long id) {if(has("ADMIN"))return;if(!db.exists("SELECT 1 FROM app_user u WHERE u.id=? AND u.role='STUDENT' AND (NOT EXISTS(SELECT 1 FROM enrollment e WHERE e.student_id=u.id) OR EXISTS(SELECT 1 FROM enrollment e JOIN coordinator_scope z ON z.group_id=e.group_id WHERE e.student_id=u.id AND z.user_id=?))",id,uid()))deny();}
    public static void deny() {throw new ResponseStatusException(HttpStatus.FORBIDDEN,"No tienes permiso para esta operación.");}
    public void group(long group,boolean manage) {
        var role=role();long uid=uid();
        boolean allowed=switch(role) {
            case "ADMIN" -> true;
            case "COORDINATOR" -> db.exists("SELECT 1 FROM coordinator_scope WHERE user_id=? AND group_id=?"+(manage?" AND can_manage=true":""),uid,group);
            case "TEACHER" -> !manage && db.exists("SELECT 1 FROM course WHERE teacher_id=? AND group_id=?",uid,group);
            default -> !manage && db.exists("SELECT 1 FROM enrollment WHERE student_id=? AND group_id=?",uid,group);
        };
        if(!allowed) deny();
    }
    public Map<String,Object> course(long id,boolean teach) {
        var c=db.one("SELECT * FROM course WHERE id=?",id);
        if(!teach && role().equals("STUDENT")) group(Db.id(c,"group_id"),false);
        else if(!has("TEACHER") || Db.id(c,"teacher_id")!=uid()) deny();
        return c;
    }
    public void userRole(long id,String role) { if(!db.exists("SELECT 1 FROM app_user WHERE id=? AND active=true",id)||!new RolePolicy(db).roles(id).contains(role)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Usuario inactivo o rol incompatible."); }
}
