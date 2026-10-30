package edu.aula;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Component
public class Db {
    public final JdbcTemplate jdbc;
    public Db(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public List<Map<String,Object>> list(String sql,Object... args) { return jdbc.queryForList(sql,args); }
    public Map<String,Object> one(String sql,Object... args) {
        var rows=list(sql,args); if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"No encontrado"); return rows.getFirst();
    }
    public boolean exists(String sql,Object... args) { return !list(sql,args).isEmpty(); }
    public int update(String sql,Object... args) { return jdbc.update(sql,args); }
    public long insert(String sql,Object... args) { return ((Number)one(sql+" RETURNING id",args).get("id")).longValue(); }
    public static long id(Map<String,Object> row,String key) { return ((Number)row.get(key)).longValue(); }
}
