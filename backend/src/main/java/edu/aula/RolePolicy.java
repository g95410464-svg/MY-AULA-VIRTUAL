package edu.aula;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@Service
public class RolePolicy {
    final Db db;
    public RolePolicy(Db db) {this.db=db;}
    public record Profile(String role,String label,int organizationLevel,String responsibility){}
    // Organizational order explains responsibility; it never grants inherited classroom access.
    public static List<Profile> hierarchy() {return List.of(
        new Profile("ADMIN","Administrador",4,"Gestiona usuarios, roles y la operación institucional."),
        new Profile("COORDINATOR","Coordinador",3,"Gestiona matrículas y coordina los grupos de su ámbito."),
        new Profile("TEACHER","Maestro",2,"Enseña y califica únicamente en sus materias asignadas."),
        new Profile("STUDENT","Alumno",1,"Estudia y entrega actividades en sus grupos matriculados.")
    );}
    public Set<String> roles(long id) {
        var user=db.one("SELECT role FROM app_user WHERE id=?",id);
        var roles=new LinkedHashSet<String>();roles.add((String)user.get("role"));
        if(!roles.contains("STUDENT") && (db.exists("SELECT 1 FROM user_secondary_role WHERE user_id=?",id) || db.exists("SELECT 1 FROM course WHERE teacher_id=?",id))) roles.add("TEACHER");
        return roles;
    }
    public List<SimpleGrantedAuthority> authorities(long id) {
        var authorities=new ArrayList<SimpleGrantedAuthority>();
        for(String role:roles(id)) {
            authorities.add(new SimpleGrantedAuthority("ROLE_"+role));
            authorities.add(new SimpleGrantedAuthority(switch(role){case "TEACHER"->"MAESTRO";case "COORDINATOR"->"COORDINADOR";case "STUDENT"->"ALUMNO";default->"ADMIN";}));
        }
        return authorities;
    }
}
