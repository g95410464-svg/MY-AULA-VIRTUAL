package edu.aula;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("!demo")
public class InitialAdmin implements CommandLineRunner {
    private final Db db;
    private final PasswordEncoder encoder;
    private final Validator validator;
    private final Account account;

    record Account(@NotBlank @Size(max=120) String name,
                   @NotBlank @Email @Size(max=200) String email,
                   @NotBlank @Size(min=12,max=72) String password) {}

    public InitialAdmin(Db db, PasswordEncoder encoder, Validator validator,
                        @Value("${app.bootstrap-admin.name:}") String name,
                        @Value("${app.bootstrap-admin.email:}") String email,
                        @Value("${app.bootstrap-admin.password:}") String password) {
        this.db=db;
        this.encoder=encoder;
        this.validator=validator;
        this.account=new Account(name.strip(),email.strip().toLowerCase(Locale.ROOT),password);
    }

    @Override
    @Transactional
    public void run(String... args) {
        if(account.name().isBlank() && account.email().isBlank() && account.password().isBlank()) return;
        // Serializa el primer arranque cuando dos instancias usan la misma base.
        db.one("SELECT pg_advisory_xact_lock(?)",615830214L);
        if(db.exists("SELECT 1 FROM app_user")) return;
        if(!validator.validate(account).isEmpty() || account.password().getBytes(StandardCharsets.UTF_8).length>72) {
            throw new IllegalArgumentException("Configura INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD; la contraseña debe tener entre 12 caracteres y 72 bytes.");
        }
        db.update("INSERT INTO app_user(name,email,password_hash,role) VALUES (?,?,?,'ADMIN')",
                  account.name(),account.email(),encoder.encode(account.password()));
    }
}
