package edu.aula;

import java.util.*;
import java.time.*;
import java.security.SecureRandom;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.mock.web.*;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("demo")
@AutoConfigureMockMvc
@Transactional
class LmsIntegrationTest {
    static final String PASSWORD=Base64.getEncoder().encodeToString(new SecureRandom().generateSeed(18));
    @DynamicPropertySource static void config(DynamicPropertyRegistry r){
        r.add("spring.datasource.url",()->System.getenv().getOrDefault("TEST_DATABASE_URL","jdbc:postgresql://127.0.0.1:55432/aula_test"));
        r.add("spring.datasource.username",()->System.getenv().getOrDefault("TEST_DATABASE_USER","aula"));
        r.add("spring.datasource.password",()->System.getenv().getOrDefault("TEST_DATABASE_PASSWORD",""));
        r.add("app.demo-password",()->PASSWORD);
    }
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired Db db;@Autowired PublicationNotifier notifier;
    @BeforeEach void refreshPassword(){db.update("UPDATE app_user SET password_hash=?,auth_version=0,must_change_password=false,active=true",new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(4).encode(PASSWORD));}
    MockHttpSession login(String who)throws Exception{return login(who,PASSWORD);}
    MockHttpSession login(String who,String pass)throws Exception{return (MockHttpSession)mvc.perform(post("/api/auth/login").with(csrf()).param("email",who+"@aula.test").param("password",pass)).andExpect(status().isNoContent()).andReturn().getRequest().getSession(false);}
    MockHttpServletRequestBuilder body(MockHttpServletRequestBuilder b,Object p)throws Exception{return b.with(csrf()).contentType("application/json").content(json.writeValueAsBytes(p));}
    JsonNode response(ResultActions r)throws Exception{return json.readTree(r.andReturn().getResponse().getContentAsByteArray());}
    Map<String,Object> task(String type){return new HashMap<>(Map.of("title","Actividad de prueba","description","Explica el procedimiento.","dueAt",OffsetDateTime.now().plusDays(2).toString(),"publishedAt",OffsetDateTime.now().minusMinutes(1).toString(),"deliveryType",type,"maxScore",100));}
    String file(MockHttpSession session,long course,String purpose)throws Exception{return response(mvc.perform(multipart("/api/courses/"+course+"/files").file(new MockMultipartFile("file","trabajo.pdf","application/pdf","%PDF-1.4\nprueba\n%%EOF".getBytes())).param("purpose",purpose).session(session).with(csrf())).andExpect(status().isOk())).get("id").asText();}
    @Test void hierarchyExplainsScopeWithoutGrantingInheritedPermissions()throws Exception{
        mvc.perform(get("/api/access-model")).andExpect(status().isUnauthorized());
        String[] users={"admin","coordinador","maestro","alumno"};
        for(int i=0;i<users.length;i++){
            var session=login(users[i]);
            mvc.perform(get("/api/access-model").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.hierarchy.length()").value(4))
                .andExpect(jsonPath("$.current.organizationLevel").value(4-i));
        }
        // The highest organizational level still cannot teach in another user's class.
        var admin=login("admin");
        mvc.perform(get("/api/access-model").session(admin)).andExpect(jsonPath("$.current.effectiveRoles[0]").value("ADMIN"));
        mvc.perform(body(post("/api/courses/1/tasks").session(admin),task("BOTH"))).andExpect(status().isForbidden());
        mvc.perform(body(put("/api/users/1/roles").session(admin),Map.of("roles",List.of("ADMIN","TEACHER")))).andExpect(status().isOk());
        mvc.perform(get("/api/access-model").session(login("admin"))).andExpect(jsonPath("$.current.organizationLevel").value(4))
            .andExpect(jsonPath("$.current.effectiveRoles").value(org.hamcrest.Matchers.containsInAnyOrder("ADMIN","TEACHER")));
    }
    @Test void unifiedLoginAndAllRoles()throws Exception{
        String[][] roles={{"admin","ADMIN"},{"maestro","TEACHER"},{"alumno","STUDENT"},{"coordinador","COORDINATOR"}};
        for(var r:roles)mvc.perform(get("/api/auth/me").session(login(r[0]))).andExpect(status().isOk()).andExpect(jsonPath("$.role").value(r[1]));
        mvc.perform(post("/api/auth/login").with(csrf()).param("email","alumno@aula.test").param("password","incorrecta")).andExpect(status().isUnauthorized());
    }
    @Test void csrfAndAnonymousProtection()throws Exception{
        mvc.perform(get("/api/courses")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").param("email","alumno@aula.test")).andExpect(status().isForbidden());
        mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andExpect(jsonPath("$.token").isNotEmpty());
        mvc.perform(post("/api/courses/1/messages").session(login("alumno")).contentType("application/json").content("{\"body\":\"hola\"}")).andExpect(status().isForbidden());
    }
    @Test void studentAndTeacherCannotEscalatePrivileges()throws Exception{
        for(String who:List.of("alumno","maestro")){
            var session=login(who);mvc.perform(get("/api/catalog").session(session)).andExpect(status().isForbidden());
            mvc.perform(body(post("/api/users").session(session),Map.of("name","Intruso","email","intruso@aula.test","role","ADMIN","password",PASSWORD))).andExpect(status().isForbidden());
        }
    }
    @Test void horizontalCourseAndCoordinatorScope()throws Exception{
        for(String who:List.of("alumno","maestro","coordinador")){
            var s=login(who);mvc.perform(get("/api/courses/5/tasks").session(s)).andExpect(status().isForbidden());mvc.perform(get("/api/courses/5/messages").session(s)).andExpect(status().isForbidden());
            var courses=response(mvc.perform(get("/api/courses").session(s)).andExpect(status().isOk()));assertThat(courses.size()).isEqualTo(who.equals("coordinador")?0:4);
        }
        var s=login("coordinador");mvc.perform(body(post("/api/notices").session(s),Map.of("groupId",2,"title","Aviso","body","Texto"))).andExpect(status().isForbidden());
        db.update("UPDATE coordinator_scope SET can_manage=false WHERE user_id=4");
        mvc.perform(body(post("/api/groups/1/enrollments").session(s),Map.of("studentId",5))).andExpect(status().isForbidden());
    }
    @Test void assignmentSubmissionGradeAndPersistence()throws Exception{
        var teacher=login("maestro");long tid=response(mvc.perform(body(post("/api/courses/1/tasks").session(teacher),task("BOTH"))).andExpect(status().isOk())).get("id").asLong();
        var student=login("alumno");String fid=file(student,1,"SUBMISSION");
        long sid=response(mvc.perform(body(post("/api/tasks/"+tid+"/submission").session(student),Map.of("fileId",fid))).andExpect(status().isOk())).get("id").asLong();
        mvc.perform(body(put("/api/submissions/"+sid+"/grade").session(teacher),Map.of("score",89,"feedback","Buen procedimiento"))).andExpect(status().isOk());
        var rows=response(mvc.perform(get("/api/courses/1/tasks").session(student)).andExpect(status().isOk()));assertThat(rows.findValuesAsText("feedback")).contains("Buen procedimiento");
        mvc.perform(body(post("/api/tasks/"+tid+"/submission").session(student),Map.of("url","https://example.org/trabajo"))).andExpect(status().isBadRequest());
        assertThat(db.one("SELECT score FROM submission WHERE id=?",sid).get("score").toString()).isEqualTo("89.00");
        assertThat(response(mvc.perform(get("/api/notifications").session(student))).size()).isGreaterThan(0);
    }
    @Test void filesArePrivateEvenWithinSameClass()throws Exception{
        var owner=login("alumno");String fid=file(owner,1,"SUBMISSION");
        mvc.perform(get("/api/files/"+fid).session(owner)).andExpect(status().isOk()).andExpect(header().string("X-Content-Type-Options","nosniff"));
        for(String who:List.of("companera","otro.alumno","otro.maestro"))mvc.perform(get("/api/files/"+fid).session(login(who))).andExpect(status().isForbidden());
        mvc.perform(get("/api/files/"+fid).session(login("maestro"))).andExpect(status().isOk());
        mvc.perform(body(post("/api/tasks/1/submission").session(login("companera")),Map.of("fileId",fid))).andExpect(status().isForbidden());
    }
    @Test void invalidFilesUrlsAndDeliveryTypeAreRejected()throws Exception{
        var s=login("alumno");mvc.perform(multipart("/api/courses/1/files").file(new MockMultipartFile("file","malware.pdf","application/pdf","<script>bad</script>".getBytes())).param("purpose","SUBMISSION").session(s).with(csrf())).andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/courses/1/files").file(new MockMultipartFile("file","file.pdf","image/png","%PDF-1.4".getBytes())).param("purpose","SUBMISSION").session(s).with(csrf())).andExpect(status().isBadRequest());
        mvc.perform(body(post("/api/tasks/1/submission").session(s),Map.of("url","javascript:alert(1)"))).andExpect(status().isBadRequest());
        db.update("UPDATE task SET delivery_type='FILE' WHERE id=1");mvc.perform(body(post("/api/tasks/1/submission").session(s),Map.of("url","https://example.org"))).andExpect(status().isBadRequest());
    }
    @Test void unpublishedTasksAndTheirFilesStayHidden()throws Exception{
        var teacher=login("maestro");String fid=file(teacher,1,"TASK");var p=task("BOTH");p.put("fileId",fid);p.put("publishedAt",OffsetDateTime.now().plusHours(2).toString());
        long tid=response(mvc.perform(body(post("/api/courses/1/tasks").session(teacher),p)).andExpect(status().isOk())).get("id").asLong();
        var student=login("alumno");mvc.perform(get("/api/tasks/"+tid+"/files").session(student)).andExpect(status().isForbidden());mvc.perform(get("/api/files/"+fid).session(student)).andExpect(status().isForbidden());
        notifier.publish();assertThat(db.one("SELECT notification_sent FROM task WHERE id=?",tid).get("notification_sent")).isEqualTo(false);
    }
    @Test void deadlinesAndGradingPermissions()throws Exception{
        var student=login("alumno");db.update("UPDATE task SET due_at=now()-interval '1 hour' WHERE id=1");
        mvc.perform(body(post("/api/tasks/1/submission").session(student),Map.of("url","https://example.org"))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/tasks/2/submissions").session(student)).andExpect(status().isForbidden());
        long sid=db.insert("INSERT INTO submission(task_id,student_id,url) VALUES (2,3,'https://example.org')");
        mvc.perform(body(put("/api/submissions/"+sid+"/grade").session(login("coordinador")),Map.of("score",90,"feedback","x"))).andExpect(status().isForbidden());
        mvc.perform(body(put("/api/submissions/"+sid+"/grade").session(login("maestro")),Map.of("score",101,"feedback","x"))).andExpect(status().isBadRequest());
    }
    @Test void deactivationRevokesExistingSessions()throws Exception{
        var s=login("alumno");var admin=login("admin");mvc.perform(body(put("/api/users/3").session(admin),Map.of("name","Lucía","email","alumno@aula.test","role","STUDENT","active",false))).andExpect(status().isOk());
        mvc.perform(get("/api/courses").session(s)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").with(csrf()).param("email","alumno@aula.test").param("password",PASSWORD)).andExpect(status().isUnauthorized());
        mvc.perform(body(put("/api/users/1").session(admin),Map.of("name","Admin","email","admin@aula.test","role","ADMIN","active",false))).andExpect(status().isBadRequest());
    }
    @Test void createUserAndForcePasswordChange()throws Exception{
        var admin=login("admin");String initial=PASSWORD+"a",next=PASSWORD+"b";
        mvc.perform(body(post("/api/users").session(admin),Map.of("name","Nuevo alumno","email","nuevo@aula.test","role","STUDENT","password",initial))).andExpect(status().isOk());
        var student=login("nuevo",initial);mvc.perform(get("/api/courses").session(student)).andExpect(status().isForbidden());
        mvc.perform(body(post("/api/auth/password").session(student),Map.of("current",initial,"password",next))).andExpect(status().isOk());
        mvc.perform(get("/api/courses").session(student)).andExpect(status().isOk());
        assertThat(login("nuevo",next)).isNotNull();
    }
    @Test void administratorCanChangeOwnEmailAndKeepAuditActor()throws Exception{
        var admin=login("admin");
        mvc.perform(body(put("/api/users/1").session(admin),Map.of("name","Administración","email","direccion@centro.edu","role","ADMIN","active",true))).andExpect(status().isOk());
        assertThat(db.one("SELECT email FROM app_user WHERE id=1")).containsEntry("email","direccion@centro.edu");
        assertThat(db.one("SELECT actor_id FROM audit_log WHERE action='EDIT_USER' AND target='1' ORDER BY id DESC LIMIT 1").get("actor_id")).isEqualTo(1L);
        mvc.perform(get("/api/auth/me").session(admin)).andExpect(status().isUnauthorized());
        var updated=(MockHttpSession)mvc.perform(post("/api/auth/login").with(csrf()).param("email","direccion@centro.edu").param("password",PASSWORD)).andExpect(status().isNoContent()).andReturn().getRequest().getSession(false);
        mvc.perform(get("/api/auth/me").session(updated)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(1)).andExpect(jsonPath("$.role").value("ADMIN"));
    }
    @Test void passwordResetInvalidatesOldSession()throws Exception{
        var student=login("alumno");mvc.perform(body(post("/api/users/3/reset").session(login("admin")),Map.of("password",PASSWORD+"reset"))).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").session(student)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").session(login("alumno",PASSWORD+"reset"))).andExpect(jsonPath("$.must_change_password").value(true));
    }
    @Test void catalogEnrollmentAssignmentAndIntegrity()throws Exception{
        var admin=login("admin");long subject=response(mvc.perform(body(post("/api/catalog/subject").session(admin),Map.of("name","Física","color","#336699"))).andExpect(status().isOk())).get("id").asLong();
        mvc.perform(body(post("/api/courses").session(admin),Map.of("subjectId",subject,"groupId",1,"teacherId",2))).andExpect(status().isOk());
        mvc.perform(body(post("/api/groups/1/enrollments").session(admin),Map.of("studentId",5))).andExpect(status().isOk());
        mvc.perform(body(post("/api/groups/1/enrollments").session(admin),Map.of("studentId",2))).andExpect(status().isBadRequest());
        assertThat(db.exists("SELECT 1 FROM audit_log WHERE action='CREATE_subject'")).isTrue();
        mvc.perform(body(post("/api/catalog/subject").session(admin),Map.of("name","Física"))).andExpect(status().isConflict());
    }
    @Test void scheduleConflictsAndAdjacentTimes()throws Exception{
        var s=login("coordinador");var p=new HashMap<String,Object>(Map.of("courseId",2,"weekday",1,"startsAt","08:30","endsAt","09:30","modality","VIRTUAL","url","https://example.org/clase"));
        mvc.perform(body(post("/api/schedules").session(s),p)).andExpect(status().isBadRequest());
        p.put("startsAt","09:00");p.put("endsAt","10:00");mvc.perform(body(post("/api/schedules").session(s),p)).andExpect(status().isOk());
        var rows=response(mvc.perform(get("/api/schedules").session(login("alumno"))));assertThat(rows.size()).isEqualTo(5);
    }
    @Test void chatHistoryNoticesAndNotificationOwnership()throws Exception{
        var student=login("alumno");long id=response(mvc.perform(body(post("/api/courses/1/messages").session(student),Map.of("body","¿Podemos revisar el ejercicio?"))).andExpect(status().isOk())).get("id").asLong();
        mvc.perform(get("/api/courses/1/messages").param("after",Long.toString(id-1)).session(login("maestro"))).andExpect(status().isOk()).andExpect(jsonPath("$[0].body").value("¿Podemos revisar el ejercicio?"));
        long n=db.insert("INSERT INTO notification(user_id,title) VALUES (7,'Privado')");mvc.perform(post("/api/notifications/"+n+"/read").session(student).with(csrf())).andExpect(status().isOk());assertThat(db.one("SELECT read_at FROM notification WHERE id=?",n).get("read_at")).isNull();
        mvc.perform(body(post("/api/notices").session(login("coordinador")),Map.of("groupId",1,"title","Reunión","body","Viernes"))).andExpect(status().isOk());
        mvc.perform(get("/api/notices").session(login("otro.alumno"))).andExpect(status().isOk()).andExpect(content().json("[]"));
    }
    @Test void pureManagersHaveNoClassroomAccess()throws Exception{
        for(String who:List.of("admin","coordinador")){
            var s=login(who);
            mvc.perform(get("/api/courses").session(s)).andExpect(content().json("[]"));
            mvc.perform(get("/api/reports").session(s)).andExpect(status().isForbidden());
            for(String path:List.of("tasks","messages","resources"))mvc.perform(get("/api/courses/1/"+path).session(s)).andExpect(status().isForbidden());
            mvc.perform(body(post("/api/courses/1/tasks").session(s),task("BOTH"))).andExpect(status().isForbidden());
        }
    }
    @Test void explicitAndAssignedTeacherRolesAreScopedAndReachSessionAuthorities()throws Exception{
        var admin=login("admin");
        mvc.perform(body(put("/api/users/1/roles").session(admin),Map.of("roles",List.of("ADMIN","TEACHER")))).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").session(admin)).andExpect(status().isUnauthorized());
        admin=login("admin");
        mvc.perform(get("/api/auth/me").session(admin)).andExpect(jsonPath("$.roles").value(org.hamcrest.Matchers.hasItem("TEACHER")));
        var context=(org.springframework.security.core.context.SecurityContext)admin.getAttribute("SPRING_SECURITY_CONTEXT");
        assertThat(context.getAuthentication().getAuthorities()).extracting("authority").contains("ROLE_ADMIN","ROLE_TEACHER","MAESTRO");
        mvc.perform(get("/api/courses").session(admin)).andExpect(content().json("[]"));
        mvc.perform(body(put("/api/courses/1/teacher").session(admin),Map.of("teacherId",1))).andExpect(status().isOk());
        mvc.perform(get("/api/courses").session(admin)).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/courses/1/tasks").session(admin)).andExpect(status().isOk());
        mvc.perform(get("/api/courses/2/tasks").session(admin)).andExpect(status().isForbidden());
        mvc.perform(body(put("/api/users/1/roles").session(admin),Map.of("roles",List.of("ADMIN")))).andExpect(status().isBadRequest());
        // Existing assignments also confer teaching access after upgrade, without a flag.
        db.update("DELETE FROM user_secondary_role WHERE user_id=1");
        mvc.perform(get("/api/auth/me").session(admin)).andExpect(jsonPath("$.roles").value(org.hamcrest.Matchers.hasItem("TEACHER")));
        mvc.perform(body(put("/api/users/3/roles").session(admin),Map.of("roles",List.of("STUDENT","TEACHER")))).andExpect(status().isBadRequest());
    }
    @Test void coordinatorEnrollmentIncludesUnassignedStudentsAndNewRegistrations()throws Exception{
        var coordinator=login("coordinador");db.update("UPDATE coordinator_scope SET can_manage=false WHERE user_id=4");
        long student=db.insert("INSERT INTO app_user(name,email,role,password_hash) SELECT 'Alumno sin matrícula','sin-grupo@aula.test','STUDENT',password_hash FROM app_user WHERE id=3");
        assertThat(response(mvc.perform(get("/api/catalog").session(coordinator))).get("people").findValuesAsText("email")).contains("sin-grupo@aula.test").doesNotContain("otro.alumno@aula.test");
        for(int i=0;i<2;i++)mvc.perform(body(post("/api/groups/1/enrollments").session(coordinator),Map.of("studentId",student))).andExpect(status().isOk());
        assertThat(db.list("SELECT * FROM enrollment WHERE student_id=? AND group_id=1",student)).hasSize(1);
        mvc.perform(body(post("/api/groups/2/enrollments").session(coordinator),Map.of("studentId",student))).andExpect(status().isForbidden());
        var input=new HashMap<String,Object>(Map.of("name","Alumno nuevo","email","matricula-nueva@aula.test","password",PASSWORD,"groupId",1));
        long id=response(mvc.perform(body(post("/api/academic/students").session(coordinator),input)).andExpect(status().isOk())).get("id").asLong();
        assertThat(db.exists("SELECT 1 FROM enrollment WHERE student_id=? AND group_id=1",id)).isTrue();
        assertThat(db.one("SELECT role,must_change_password FROM app_user WHERE id=?",id)).containsEntry("role","STUDENT").containsEntry("must_change_password",true);
        input.put("email","fuera-scope@aula.test");input.put("groupId",2);
        mvc.perform(body(post("/api/academic/students").session(coordinator),input)).andExpect(status().isForbidden());
        assertThat(db.exists("SELECT 1 FROM app_user WHERE email='fuera-scope@aula.test'")).isFalse();
        mvc.perform(body(post("/api/users").session(coordinator),Map.of("name","No permitido","email","no@aula.test","password",PASSWORD,"role","STUDENT"))).andExpect(status().isForbidden());
    }
    @Test void annotationsArePersonalAndCsrfProtectedAndEventsAreInstitutional()throws Exception{
        String day=LocalDate.now().toString();var teacher=login("maestro");var input=Map.of("date",day,"title","Nota privada","content","Revisar entregas");
        mvc.perform(post("/api/calendar/annotations").session(teacher).contentType("application/json").content(json.writeValueAsBytes(input))).andExpect(status().isForbidden());
        long id=response(mvc.perform(body(post("/api/calendar/annotations").session(teacher),input)).andExpect(status().isOk())).get("id").asLong();
        var coordinator=login("coordinador");
        mvc.perform(get("/api/calendar/annotations").param("from",day).param("to",day).session(coordinator)).andExpect(content().json("[]"));
        mvc.perform(delete("/api/calendar/annotations/"+id).session(coordinator).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(get("/api/calendar/annotations").param("from",day).param("to",day).session(teacher)).andExpect(jsonPath("$[0].title").value("Nota privada"));
        mvc.perform(body(post("/api/calendar/annotations").session(coordinator),input)).andExpect(status().isOk());
        mvc.perform(body(post("/api/calendar/annotations").session(login("alumno")),input)).andExpect(status().isForbidden());
        mvc.perform(body(post("/api/calendar/events").session(teacher),input)).andExpect(status().isForbidden());
        long event=response(mvc.perform(body(post("/api/calendar/events").session(login("admin")),input)).andExpect(status().isOk())).get("id").asLong();
        mvc.perform(get("/api/calendar/events").param("from",day).param("to",day).session(login("alumno"))).andExpect(jsonPath("$[0].id").value(event));
        mvc.perform(delete("/api/calendar/annotations/"+id).session(teacher).with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/calendar/annotations").param("from",day).param("to",LocalDate.now().minusDays(1).toString()).session(teacher)).andExpect(status().isBadRequest());
    }
    @Test void staffConversationsNeverLeakToStudentsOrUnrelatedTeachers()throws Exception{
        MockHttpSession coordinator=login("coordinador"),teacher=login("maestro"),student=login("alumno");
        long id=response(mvc.perform(body(post("/api/conversations").session(coordinator),Map.of("recipientId",2))).andExpect(status().isOk())).get("id").asLong();
        mvc.perform(body(post("/api/conversations/"+id+"/messages").session(coordinator),Map.of("body","Mensaje confidencial"))).andExpect(status().isOk());
        mvc.perform(body(post("/api/conversations/"+id+"/messages").session(teacher),Map.of("body","Recibido"))).andExpect(status().isOk());
        mvc.perform(get("/api/conversations/"+id+"/messages").session(teacher)).andExpect(jsonPath("$.messages.length()").value(2));
        mvc.perform(get("/api/conversations").session(student)).andExpect(content().json("[]"));
        for(String who:List.of("alumno","companera","otro.maestro","admin")){
            var s=login(who);mvc.perform(get("/api/conversations/"+id+"/messages").session(s)).andExpect(status().isForbidden());
            mvc.perform(body(post("/api/conversations/"+id+"/messages").session(s),Map.of("body","Intrusión"))).andExpect(status().isForbidden());
        }
        mvc.perform(body(post("/api/conversations").session(coordinator),Map.of("recipientId",3))).andExpect(status().isForbidden());
        mvc.perform(body(post("/api/conversations").session(student),Map.of("recipientId",4))).andExpect(status().isForbidden());
        mvc.perform(body(post("/api/conversations").session(coordinator),Map.of("recipientId",6))).andExpect(status().isForbidden());
        assertThat(response(mvc.perform(get("/api/message-recipients").session(coordinator))).findValuesAsText("role")).doesNotContain("STUDENT");
        db.update("DELETE FROM coordinator_scope WHERE user_id=4");
        mvc.perform(get("/api/conversations").session(coordinator)).andExpect(content().json("[]"));
        mvc.perform(get("/api/conversations/"+id+"/messages").session(teacher)).andExpect(status().isForbidden());
    }
    @Test void adminStudentMessagesAreReadOnlyEvenWithForgedRequests()throws Exception{
        MockHttpSession admin=login("admin"),student=login("alumno");
        long id=response(mvc.perform(body(post("/api/conversations").session(admin),Map.of("recipientId",3))).andExpect(status().isOk())).get("id").asLong();
        mvc.perform(body(post("/api/conversations/"+id+"/messages").session(admin),Map.of("body","Aviso privado"))).andExpect(status().isOk());
        mvc.perform(get("/api/conversations/"+id+"/messages").session(student)).andExpect(jsonPath("$.readOnly").value(true)).andExpect(jsonPath("$.messages[0].body").value("Aviso privado"));
        mvc.perform(body(post("/api/conversations/"+id+"/messages").session(student),Map.of("body","Respuesta manipulada"))).andExpect(status().isForbidden());
        mvc.perform(body(post("/api/conversations").session(student),Map.of("recipientId",1))).andExpect(status().isForbidden());
        mvc.perform(get("/api/conversations/"+id+"/messages").session(login("companera"))).andExpect(status().isForbidden());
        long staff=response(mvc.perform(body(post("/api/conversations").session(admin),Map.of("recipientId",2))).andExpect(status().isOk())).get("id").asLong();
        mvc.perform(body(post("/api/conversations/"+staff+"/messages").session(login("maestro")),Map.of("body","Respuesta del docente"))).andExpect(status().isOk());
    }
    @Test void filteredSchedulesCanBeEditedAndRejectOverlapsAndUnauthorizedTeachers()throws Exception{
        MockHttpSession admin=login("admin"),coordinator=login("coordinador");
        mvc.perform(get("/api/schedules").session(admin)).andExpect(content().json("[]"));
        mvc.perform(get("/api/schedules").param("teacherId","2").session(admin)).andExpect(jsonPath("$.length()").value(4));
        mvc.perform(get("/api/schedules").param("teacherId","6").session(coordinator)).andExpect(status().isForbidden());
        mvc.perform(get("/api/schedules").param("teacherId","2").session(login("alumno"))).andExpect(status().isForbidden());
        var block=new HashMap<String,Object>(Map.of("courseId",1,"weekday",1,"startsAt","08:00","endsAt","09:00","modality","PRESENCIAL"));
        long id=Db.id(db.one("SELECT id FROM schedule WHERE course_id=1"),"id");
        mvc.perform(body(put("/api/schedules/"+id).session(admin),block)).andExpect(status().isOk());
        block.put("startsAt","07:00");block.put("endsAt","08:00");mvc.perform(body(put("/api/schedules/"+id).session(coordinator),block)).andExpect(status().isOk());
        var recess=Map.of("teacherId",2,"weekday",1,"startsAt","08:00","endsAt","08:30","title","Receso");
        long rid=response(mvc.perform(body(post("/api/schedule-breaks").session(admin),recess)).andExpect(status().isOk())).get("id").asLong();
        block.put("startsAt","08:15");block.put("endsAt","09:00");mvc.perform(body(put("/api/schedules/"+id).session(admin),block)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/schedule-breaks").session(login("maestro"))).andExpect(jsonPath("$[0].title").value("Receso"));
        mvc.perform(delete("/api/schedule-breaks/"+rid).session(login("maestro")).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(delete("/api/schedule-breaks/"+rid).session(admin).with(csrf())).andExpect(status().isOk());
        db.update("UPDATE coordinator_scope SET can_manage=false WHERE user_id=4");
        mvc.perform(body(put("/api/schedules/"+id).session(coordinator),block)).andExpect(status().isForbidden());
    }
    @Test void teacherCrudPreservesHistoryAndRevokesSessions()throws Exception{
        var admin=login("admin");var input=Map.of("name","Nuevo docente","email","nuevo-docente@aula.test","password",PASSWORD);
        long id=response(mvc.perform(body(post("/api/teachers").session(admin),input)).andExpect(status().isOk())).get("id").asLong();
        mvc.perform(get("/api/teachers/"+id).session(admin)).andExpect(jsonPath("$.role").value("TEACHER"));
        mvc.perform(body(put("/api/teachers/"+id).session(admin),Map.of("name","Docente editado","email","nuevo-docente@aula.test","active",true))).andExpect(status().isOk());
        var teacher=login("maestro");
        mvc.perform(delete("/api/teachers/2").session(admin).with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/courses").session(teacher)).andExpect(status().isUnauthorized());
        assertThat(db.list("SELECT * FROM course WHERE teacher_id=2")).hasSize(4);
        mvc.perform(body(post("/api/teachers").session(login("coordinador")),input)).andExpect(status().isForbidden());
    }
    @Test void submissionsAndAttachmentsRemainVisibleAfterStudentWithdrawal()throws Exception{
        MockHttpSession student=login("alumno"),teacher=login("maestro");String fid=file(student,1,"SUBMISSION");
        long sid=response(mvc.perform(body(post("/api/tasks/1/submission").session(student),Map.of("fileId",fid))).andExpect(status().isOk())).get("id").asLong();
        db.update("DELETE FROM enrollment WHERE student_id=3 AND group_id=1");
        var rows=response(mvc.perform(get("/api/tasks/1/submissions").session(teacher)).andExpect(status().isOk()));
        assertThat(rows.findValuesAsText("file_name")).contains("trabajo.pdf");assertThat(rows.findValuesAsText("id")).contains(Long.toString(sid));
        mvc.perform(get("/api/submissions/"+sid).session(teacher)).andExpect(jsonPath("$.file_name").value("trabajo.pdf"));
        mvc.perform(get("/api/files/"+fid).param("preview","true").session(teacher)).andExpect(status().isOk()).andExpect(header().string("Content-Disposition",org.hamcrest.Matchers.startsWith("inline")));
        for(String who:List.of("coordinador","admin","otro.maestro","companera"))mvc.perform(get("/api/submissions/"+sid).session(login(who))).andExpect(status().isForbidden());
        var tasks=response(mvc.perform(get("/api/courses/1/tasks").session(teacher)));assertThat(tasks.get(0).get("submission_count").asInt()).isEqualTo(1);
    }
    @Test void resourcesAndCoordinatorReports()throws Exception{
        mvc.perform(body(post("/api/courses/1/resources").session(login("maestro")),Map.of("title","Guía","unit","Unidad 2","body","Contenido","url","https://example.org/guia"))).andExpect(status().isOk());
        assertThat(response(mvc.perform(get("/api/courses/1/resources").session(login("alumno")))).size()).isEqualTo(2);
        mvc.perform(get("/api/reports").session(login("coordinador"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/audit").session(login("coordinador"))).andExpect(status().isForbidden());
    }
}

