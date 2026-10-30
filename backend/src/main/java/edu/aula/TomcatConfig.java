package edu.aula;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.*;

@Configuration
public class TomcatConfig {
    // Optional alternate connector for Windows/MSIX hosts whose NIO selector cannot open an AF_UNIX pipe.
    @Bean
    @ConditionalOnProperty(name="app.tomcat-nio2",havingValue="true")
    WebServerFactoryCustomizer<TomcatServletWebServerFactory> nio2(){return factory->factory.setProtocol("org.apache.coyote.http11.Http11Nio2Protocol");}
}
