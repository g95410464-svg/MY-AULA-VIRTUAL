package edu.aula;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class Errors {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> status(ResponseStatusException e) { return ResponseEntity.status(e.getStatusCode()).body(Map.of("message",ObjectsSafe.reason(e.getReason()))); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> conflict(Exception e) { return ResponseEntity.status(409).body(Map.of("message","El registro ya existe o tiene relaciones que impiden el cambio.")); }
    @ExceptionHandler({MethodArgumentNotValidException.class,IllegalArgumentException.class,org.springframework.http.converter.HttpMessageNotReadableException.class})
    ResponseEntity<?> invalid(Exception e) { return ResponseEntity.badRequest().body(Map.of("message","Revisa los datos y campos obligatorios.")); }
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<?> size(Exception e) { return ResponseEntity.status(413).body(Map.of("message","El archivo excede 5 MB.")); }
    static class ObjectsSafe { static String reason(String r) {return r==null?"Solicitud rechazada":r;} }
}
