package edu.aula;

import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final Db db; private final Access access; private final PasswordEncoder encoder;
    public AuthController(Db d,Access a,PasswordEncoder e){db=d;access=a;encoder=e;}
    @GetMapping("/csrf") Map<String,String> csrf(CsrfToken token){return Map.of("token",token.getToken());}
    @GetMapping("/me") Map<String,Object> me(){return access.me();}
    public record Password(@NotBlank String current,@NotNull @Size(min=12,max=72) String password){}
    @PostMapping("/password") @Transactional
    void password(@RequestBody @Valid Password p,HttpServletRequest req){
        long id=access.uid();var u=db.one("SELECT password_hash FROM app_user WHERE id=? FOR UPDATE",id);
        if(!encoder.matches(p.current(),(String)u.get("password_hash")))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"La contraseña actual no es correcta.");
        if(p.current().equals(p.password()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Usa una contraseña diferente.");
        db.update("UPDATE app_user SET password_hash=?,must_change_password=false,auth_version=auth_version+1 WHERE id=?",encoder.encode(p.password()),id);
        req.getSession().setAttribute("version",db.one("SELECT auth_version FROM app_user WHERE id=?",id).get("auth_version"));
        db.update("INSERT INTO audit_log(actor_id,action,target) VALUES (?,'PASSWORD_CHANGED',?)",id,Long.toString(id));
    }
}
