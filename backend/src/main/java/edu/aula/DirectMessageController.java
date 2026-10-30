package edu.aula;

import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api")
public class DirectMessageController {
    final Db db;final Access a;final RolePolicy policy;
    public DirectMessageController(Db db,Access a,RolePolicy policy){this.db=db;this.a=a;this.policy=policy;}
    boolean active(long id){return db.exists("SELECT 1 FROM app_user WHERE id=? AND active=true",id);}
    boolean staffPair(long first,long second){
        var one=policy.roles(first);var two=policy.roles(second);
        if(one.contains("STUDENT")||two.contains("STUDENT"))return false;
        return one.contains("COORDINATOR")&&two.contains("TEACHER")&&shared(first,second) || two.contains("COORDINATOR")&&one.contains("TEACHER")&&shared(second,first);
    }
    boolean shared(long coordinator,long teacher){return db.exists("SELECT 1 FROM coordinator_scope z JOIN course c ON c.group_id=z.group_id WHERE z.user_id=? AND c.teacher_id=?",coordinator,teacher);}
    boolean visible(Map<String,Object> c){
        long first=Db.id(c,"first_user_id"),second=Db.id(c,"second_user_id");
        if(a.uid()!=first&&a.uid()!=second)return false;
        if(!active(first)||!active(second))return false;
        if(c.get("kind").equals("STAFF"))return staffPair(first,second);
        return policy.roles(Db.id(c,"created_by")).contains("ADMIN");
    }
    boolean readOnly(Map<String,Object> c){return a.role().equals("STUDENT") || Boolean.TRUE.equals(c.get("student_read_only"))&&Db.id(c,"created_by")!=a.uid();}
    Map<String,Object> conversation(long id){var c=db.one("SELECT * FROM direct_conversation WHERE id=?",id);if(!visible(c))Access.deny();return c;}
    @GetMapping("/message-recipients") List<Map<String,Object>> recipients(@RequestParam(defaultValue="") @Size(max=120) String search){
        if(a.role().equals("STUDENT"))return List.of();
        var result=new ArrayList<Map<String,Object>>();
        for(var u:db.list("SELECT id,name,email,role FROM app_user WHERE active=true AND id<>? AND name ILIKE ? ORDER BY name",a.uid(),"%"+search+"%")) {
            long id=Db.id(u,"id");if(a.has("ADMIN")||staffPair(a.uid(),id)){u.put("roles",policy.roles(id));result.add(u);if(result.size()==100)break;}
        }
        return result;
    }
    @GetMapping("/conversations") List<Map<String,Object>> conversations(){
        var rows=db.list("SELECT c.*,u.name recipient_name,u.role recipient_role FROM direct_conversation c JOIN app_user u ON u.id=CASE WHEN c.first_user_id=? THEN c.second_user_id ELSE c.first_user_id END WHERE c.first_user_id=? OR c.second_user_id=? ORDER BY c.id DESC",a.uid(),a.uid(),a.uid());
        var result=new ArrayList<Map<String,Object>>();
        for(var c:rows)if(visible(c)){c.put("read_only",readOnly(c));result.add(c);}return result;
    }
    public record ConversationInput(@Positive long recipientId){}
    @PostMapping("/conversations") @Transactional Map<String,Long> create(@RequestBody @Valid ConversationInput p){
        if(a.role().equals("STUDENT")||p.recipientId()==a.uid()||!active(p.recipientId()))Access.deny();
        boolean admin=a.has("ADMIN");if(!admin&&!staffPair(a.uid(),p.recipientId()))Access.deny();
        long first=Math.min(a.uid(),p.recipientId()),second=Math.max(a.uid(),p.recipientId());String kind=admin?"ADMIN_DIRECT":"STAFF";
        long id=db.insert("INSERT INTO direct_conversation(kind,first_user_id,second_user_id,created_by,student_read_only) VALUES (?,?,?,?,?) ON CONFLICT(kind,first_user_id,second_user_id) DO UPDATE SET kind=excluded.kind",kind,first,second,a.uid(),admin&&policy.roles(p.recipientId()).contains("STUDENT"));
        conversation(id);return Map.of("id",id);
    }
    @GetMapping("/conversations/{id}/messages") Map<String,Object> messages(@PathVariable long id,@RequestParam(defaultValue="0") @PositiveOrZero long after){
        var c=conversation(id);var rows=db.list("SELECT m.*,u.name sender_name FROM direct_message m JOIN app_user u ON u.id=m.sender_id WHERE conversation_id=? AND m.id>? ORDER BY m.id "+(after==0?"DESC":"ASC")+" LIMIT 100",id,after);if(after==0)Collections.reverse(rows);
        return Map.of("conversation",c,"readOnly",readOnly(c),"messages",rows);
    }
    public record MessageInput(@NotBlank @Size(max=3000) String body){}
    @PostMapping("/conversations/{id}/messages") @Transactional Map<String,Long> send(@PathVariable long id,@RequestBody @Valid MessageInput p){
        db.one("SELECT id FROM direct_conversation WHERE id=? FOR UPDATE",id);var c=conversation(id);if(readOnly(c))Access.deny();
        long mid=db.insert("INSERT INTO direct_message(conversation_id,sender_id,body) VALUES (?,?,?)",id,a.uid(),p.body());
        long recipient=Db.id(c,"first_user_id")==a.uid()?Db.id(c,"second_user_id"):Db.id(c,"first_user_id");
        db.update("INSERT INTO notification(user_id,title) VALUES (?,?)",recipient,"Mensaje privado de "+a.me().get("name"));return Map.of("id",mid);
    }
}
