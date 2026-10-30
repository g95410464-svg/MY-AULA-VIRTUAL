package edu.aula;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.*;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.csrf.*;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwords() { return new BCryptPasswordEncoder(12); }
    @Bean UserDetailsService users(Db db,RolePolicy policy) {
        return email -> {
            var rows=db.list("SELECT * FROM app_user WHERE email=?",email.toLowerCase(java.util.Locale.ROOT));
            if(rows.isEmpty()) throw new UsernameNotFoundException("Credenciales inválidas");
            var u=rows.getFirst();
            return User.withUsername((String)u.get("email")).password((String)u.get("password_hash"))
                .authorities(policy.authorities(Db.id(u,"id"))).disabled(!(Boolean)u.get("active")).build();
        };
    }
    @Bean SecurityFilterChain security(HttpSecurity http,Db db,RolePolicy policy) throws Exception {
        var csrf=new CsrfTokenRequestAttributeHandler();
        var attempts=new ConcurrentHashMap<String,long[]>();
        var limiter=new OncePerRequestFilter() {
            protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
                if(req.getMethod().equals("POST") && req.getRequestURI().equals(req.getContextPath()+"/api/auth/login")) {
                    var key=req.getRemoteAddr()+"|"+String.valueOf(req.getParameter("email")).toLowerCase(java.util.Locale.ROOT); long now=Instant.now().getEpochSecond();
                    if(attempts.size()>10000) attempts.entrySet().removeIf(e -> e.getValue()[0]<now-900);
                    var bucket=attempts.compute(key,(k,v)->v==null||v[0]<now-900?new long[]{now,1}:new long[]{v[0],v[1]+1});
                    if(bucket[1]>10) {res.setStatus(429); res.setContentType("application/json"); res.getWriter().write("{\"message\":\"Demasiados intentos. Espera 15 minutos.\"}");return;}
                }
                chain.doFilter(req,res);
            }
        };
        var activeAccount=new OncePerRequestFilter() {
            protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
                var auth=SecurityContextHolder.getContext().getAuthentication();
                if(auth!=null && auth.getPrincipal() instanceof UserDetails) {
                    var rows=db.list("SELECT id,active,auth_version,must_change_password FROM app_user WHERE email=?",auth.getName());
                    var session=req.getSession(false);
                    if(rows.isEmpty() || !(Boolean)rows.getFirst().get("active") || session==null || !rows.getFirst().get("auth_version").equals(session.getAttribute("version"))) {
                        SecurityContextHolder.clearContext(); if(session!=null) session.invalidate(); res.setStatus(401);return;
                    }
                    var refreshed=new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(auth.getPrincipal(),auth.getCredentials(),policy.authorities(Db.id(rows.getFirst(),"id")));
                    refreshed.setDetails(auth.getDetails());SecurityContextHolder.getContext().setAuthentication(refreshed);
                    String route=req.getRequestURI().substring(req.getContextPath().length());
                    if((Boolean)rows.getFirst().get("must_change_password") && !java.util.Set.of("/api/auth/me","/api/auth/csrf","/api/auth/password","/api/auth/logout").contains(route) && route.startsWith("/api/")) {
                        res.setStatus(403);res.setContentType("application/json");res.getWriter().write("{\"message\":\"Debes cambiar tu contraseña temporal.\"}");return;
                    }
                }
                chain.doFilter(req,res);
            }
        };
        return http.csrf(c->c.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()).csrfTokenRequestHandler(csrf))
            .headers(h->h.contentSecurityPolicy(c->c.policyDirectives("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")))
            .authorizeHttpRequests(a->a.requestMatchers("/","/index.html","/assets/**","/favicon.svg","/api/auth/csrf","/api/auth/login","/error").permitAll().anyRequest().authenticated())
            .exceptionHandling(e->e.authenticationEntryPoint((r,s,x)->s.sendError(401)).accessDeniedHandler((r,s,x)->s.sendError(403)))
            .formLogin(f->f.loginProcessingUrl("/api/auth/login").usernameParameter("email")
                .successHandler((r,s,a)-> {attempts.remove(r.getRemoteAddr()+"|"+a.getName());r.getSession().setAttribute("version",db.one("SELECT auth_version FROM app_user WHERE email=?",a.getName()).get("auth_version"));s.setStatus(204);})
                .failureHandler((r,s,e)->s.sendError(401,"Credenciales inválidas")))
            .logout(l->l.logoutUrl("/api/auth/logout").logoutSuccessHandler((r,s,a)->s.setStatus(204)).deleteCookies("JSESSIONID","XSRF-TOKEN"))
            .addFilterBefore(limiter,org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(activeAccount,AuthorizationFilter.class).build();
    }
}
