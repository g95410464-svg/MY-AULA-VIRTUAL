package edu.aula;

import java.security.SecureRandom;
import java.util.Base64;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
class InitialAdminTest {
    @DynamicPropertySource static void config(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",()->System.getenv().getOrDefault("TEST_BOOTSTRAP_DATABASE_URL","jdbc:postgresql://127.0.0.1:55432/aula_bootstrap_test"));
        r.add("spring.datasource.username",()->System.getenv().getOrDefault("TEST_DATABASE_USER","aula"));
        r.add("spring.datasource.password",()->System.getenv().getOrDefault("TEST_DATABASE_PASSWORD",""));
        r.add("app.bootstrap-admin.name",()->"");
        r.add("app.bootstrap-admin.email",()->"");
        r.add("app.bootstrap-admin.password",()->"");
    }
    @Autowired Db db;
    @Autowired PasswordEncoder encoder;
    @Autowired Validator validator;
    @Autowired ApplicationContext context;
    String password(){return Base64.getEncoder().encodeToString(new SecureRandom().generateSeed(24));}
    InitialAdmin initializer(String name,String email,String password){return new InitialAdmin(db,encoder,validator,name,email,password);}
    long users(){return ((Number)db.one("SELECT count(*) AS total FROM app_user").get("total")).longValue();}

    @Test void defaultStartupDoesNotLoadDemoData() {
        assertThat(context.getBeansOfType(Seed.class)).isEmpty();
        assertThat(users()).isZero();
        initializer("","","").run();
        assertThat(users()).isZero();
        for(String table:new String[]{"period","grade","section","subject","study_group","course","task","notice","message"}) {
            assertThat(db.exists("SELECT 1 FROM "+table)).as(table).isFalse();
        }
    }

    @Test void createsOnlyTheConfiguredAdministratorWithBcrypt() {
        String secret=password();
        initializer(" Dirección "," DIRECCION@CENTRO.EDU ",secret).run();
        assertThat(users()).isEqualTo(1);
        var account=db.one("SELECT name,email,role,password_hash,active FROM app_user");
        assertThat(account).containsEntry("name","Dirección").containsEntry("email","direccion@centro.edu").containsEntry("role","ADMIN").containsEntry("active",true);
        assertThat(encoder.matches(secret,(String)account.get("password_hash"))).isTrue();
        assertThat(account.get("password_hash")).isNotEqualTo(secret);
        assertThat(db.exists("SELECT 1 FROM course")).isFalse();
        assertThat(db.exists("SELECT 1 FROM task")).isFalse();
    }

    @Test void restartDoesNotResetOrCreateAnotherAccount() {
        String original=password();
        initializer("Dirección","direccion@centro.edu",original).run();
        initializer("Otra cuenta","otra@centro.edu",password()).run();
        assertThat(users()).isEqualTo(1);
        assertThat(encoder.matches(original,(String)db.one("SELECT password_hash FROM app_user").get("password_hash"))).isTrue();
    }

    @Test void rejectsPartialConfigurationWithoutCreatingUsers() {
        assertThatIllegalArgumentException().isThrownBy(()->initializer("Dirección","",password()).run());
        assertThat(users()).isZero();
    }

    @Test void rejectsInvalidEmailWithoutCreatingUsers() {
        assertThatIllegalArgumentException().isThrownBy(()->initializer("Dirección","correo inválido",password()).run());
        assertThat(users()).isZero();
    }

    @Test void rejectsShortPasswordsWithoutExposingThem() {
        String secret="corta";
        assertThatIllegalArgumentException().isThrownBy(()->initializer("Dirección","direccion@centro.edu",secret).run())
            .withMessageNotContaining(secret);
        assertThat(users()).isZero();
    }

    @Test void rejectsPasswordsOverBcryptByteLimit() {
        assertThatIllegalArgumentException().isThrownBy(()->initializer("Dirección","direccion@centro.edu","á".repeat(37)).run());
        assertThat(users()).isZero();
    }
}
