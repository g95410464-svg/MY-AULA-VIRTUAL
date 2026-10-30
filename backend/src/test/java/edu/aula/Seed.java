package edu.aula;

import java.time.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("demo")
public class Seed implements CommandLineRunner {
    final Db db; final PasswordEncoder encoder; final String password; final ZoneId zone;
    public Seed(Db db,PasswordEncoder e,@Value("${app.demo-password:${DEMO_PASSWORD:}}") String p,@Value("${app.timezone}") String timezone){this.db=db;encoder=e;password=p;zone=ZoneId.of(timezone);}
    @Override @Transactional public void run(String... args){
        if(password.isBlank()||db.exists("SELECT 1 FROM app_user"))return;
        if(password.length()<12||password.length()>72)throw new IllegalArgumentException("DEMO_PASSWORD debe tener entre 12 y 72 caracteres.");
        String hash=encoder.encode(password);
        String[][] users={{"Administración","admin@aula.test","ADMIN"},{"Ana Martínez","maestro@aula.test","TEACHER"},{"Lucía Gómez","alumno@aula.test","STUDENT"},{"Carlos Méndez","coordinador@aula.test","COORDINATOR"},{"Diego López","otro.alumno@aula.test","STUDENT"},{"María Pérez","otro.maestro@aula.test","TEACHER"},{"Sofía Díaz","companera@aula.test","STUDENT"}};
        for(var u:users)db.update("INSERT INTO app_user(name,email,password_hash,role) VALUES (?,?,?,?)",u[0],u[1],hash,u[2]);
        var year=LocalDate.now(zone).getYear();
        db.update("INSERT INTO period(name,starts_on,ends_on) VALUES (?,?,?)","Ciclo "+year,LocalDate.of(year,1,1),LocalDate.of(year,12,31));
        db.update("INSERT INTO grade(name) VALUES ('Tercero básico')");db.update("INSERT INTO section(name) VALUES ('A'),('B')");
        db.update("INSERT INTO study_group(name,period_id,grade_id,section_id) VALUES ('Tercero A',1,1,1),('Tercero B',1,1,2)");
        db.update("INSERT INTO enrollment VALUES (3,1),(5,2),(7,1)");db.update("INSERT INTO coordinator_scope VALUES (4,1,true)");
        db.update("INSERT INTO subject(name,color) VALUES ('Matemáticas','#6d5ce7'),('Ciencias Naturales','#0d9488'),('Lenguaje y Literatura','#e59635'),('Inglés','#4185cf')");
        db.update("INSERT INTO course(subject_id,group_id,teacher_id) VALUES (1,1,2),(2,1,2),(3,1,2),(4,1,2),(1,2,6)");
        for(int c=1;c<=4;c++){
            db.update("INSERT INTO schedule(course_id,weekday,starts_at,ends_at,modality) VALUES (?,?,?,?,?)",c,c,LocalTime.of(7+c,0),LocalTime.of(8+c,0),"PRESENCIAL");
            db.update("INSERT INTO task(course_id,title,description,due_at,delivery_type,max_score) VALUES (?,?,?,?,?,100)",c,new String[]{"Exploramos las ecuaciones","Nuestro ecosistema","El poder de una historia","My daily routine"}[c-1],"Revisa el material de la unidad y presenta una explicación con ejemplos. Puedes adjuntar un documento o compartir un enlace.",OffsetDateTime.now().plusDays(c+2),"BOTH");
            db.update("INSERT INTO resource(course_id,title,unit,body) VALUES (?,?,?,?)",c,"Guía de aprendizaje","Unidad 1","Bienvenidos. En esta unidad aprenderemos a resolver problemas, compartir ideas y trabajar con autonomía.");
        }
        db.update("INSERT INTO notice(group_id,author_id,title,body) VALUES (1,4,'Un nuevo espacio para aprender','Consulta tus actividades, conversa con tus docentes y organiza tu semana desde el aula virtual.')");
        db.update("INSERT INTO message(course_id,sender_id,body) VALUES (1,2,'¡Bienvenidos! Este espacio es para compartir dudas sobre la asignatura.')");
    }
}
