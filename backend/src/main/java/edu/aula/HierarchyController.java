package edu.aula;

import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class HierarchyController {
    final Access access;
    public HierarchyController(Access access){this.access=access;}
    public record Permission(String action,String admin,String coordinator,String teacher,String student){}
    @GetMapping("/access-model") Map<String,Object> model(){
        var me=access.me();
        int level=RolePolicy.hierarchy().stream().filter(p->p.role().equals(me.get("role"))).findFirst().orElseThrow().organizationLevel();
        return Map.of("hierarchy",RolePolicy.hierarchy(),"current",Map.of("primaryRole",me.get("role"),"effectiveRoles",me.get("roles"),"organizationLevel",level),"permissions",List.of(
            new Permission("Administrar usuarios, roles y maestros","Institución","Sin acceso","Sin acceso","Sin acceso"),
            new Permission("Registrar alumnos y matricular","Institución","Grupos de su ámbito","Sin acceso","Sin acceso"),
            new Permission("Asignar maestros y editar horarios","Institución","Grupos con permiso de gestión","Sin acceso","Sin acceso"),
            new Permission("Crear actividades, materiales y calificar","Solo con rol Maestro; materias propias","Solo con rol Maestro; materias propias","Materias asignadas","Sin acceso"),
            new Permission("Consultar reportes académicos","Solo con rol Maestro; materias propias","Solo con rol Maestro; materias propias","Materias asignadas","Sin acceso"),
            new Permission("Consultar materiales y actividades","Solo con rol Maestro; materias propias","Solo con rol Maestro; materias propias","Materias asignadas","Grupos matriculados"),
            new Permission("Entregar trabajos y consultar notas","Sin acceso como alumno","Sin acceso como alumno","Revisa entregas de sus materias","Solo sus propias entregas y notas"),
            new Permission("Crear anotaciones personales","Solo sus anotaciones","Solo sus anotaciones","Solo sus anotaciones","Sin acceso"),
            new Permission("Gestionar eventos institucionales","Crear y eliminar","Solo lectura","Solo lectura","Solo lectura"),
            new Permission("Chat de la asignatura","Solo con rol Maestro; materias propias","Solo con rol Maestro; materias propias","Con sus grupos","Con sus grupos"),
            new Permission("Mensajes privados de coordinación","Solo como Maestro participante","Con maestros de grupos compartidos","Con coordinadores de grupos compartidos","Sin acceso"),
            new Permission("Mensajes privados de Administración","Inicia conversaciones con usuarios activos","Puede responder si es destinatario","Puede responder si es destinatario","Solo lectura; no inicia ni responde"),
            new Permission("Consultar auditoría institucional","Institución","Sin acceso","Sin acceso","Sin acceso")
        ));
    }
}
