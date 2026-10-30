import { test, expect, type Page } from "@playwright/test";
const password = process.env.E2E_PASSWORD!;
async function login(page: Page, who: string) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(`${who}@aula.test`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi aula" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
}
async function nav(page: Page, name: string) {
  await page.locator("nav").getByRole("button", { name }).click();
}
async function save(page: Page) {
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function mutation(
  page: Page,
  path: string,
  body: unknown,
  method = "POST",
) {
  const token = await (await page.request.get("/api/auth/csrf")).json();
  const response = await page.request.fetch(`/api${path}`, {
    method,
    headers: { "X-XSRF-TOKEN": token.token },
    data: body,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response;
}

test("entregas desde Actividades: adjunto, contador y detalle con descarga", async ({
  browser,
}) => {
  const teacher = await browser.newPage(),
    student = await browser.newPage();
  await login(teacher, "maestro");
  const title = `Adjunto examen ${Date.now()}`;
  const created = await mutation(teacher, "/courses/1/tasks", {
    title,
    description: "Adjunta tu trabajo",
    publishedAt: new Date(Date.now() - 60000).toISOString(),
    dueAt: new Date(Date.now() + 86400000).toISOString(),
    deliveryType: "FILE",
    maxScore: 100,
  });
  const taskId = (await created.json()).id;
  await teacher.reload();
  await nav(teacher, "Actividades");
  const teacherTask = teacher.locator(".task-row").filter({ hasText: title });
  await expect(
    teacherTask.getByRole("button", { name: /Ver entregas\s*0/ }),
  ).toBeVisible();
  await login(student, "alumno");
  await nav(student, "Actividades");
  await student
    .locator(".task-row")
    .filter({ hasText: title })
    .getByRole("button", { name: "Entregar", exact: true })
    .click();
  await student.locator('input[type="file"]').setInputFiles({
    name: "respuesta.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nrespuesta\n%%EOF"),
  });
  await save(student);
  await teacher.bringToFront();
  await expect(
    teacherTask.getByRole("button", { name: /Ver entregas\s*1/ }),
  ).toBeVisible({ timeout: 20000 });
  await teacherTask.getByRole("button", { name: /Ver entregas/ }).click();
  await expect(
    teacher.getByRole("heading", { name: `Entregas · ${title}` }),
  ).toBeVisible();
  await teacher
    .getByRole("row")
    .filter({ hasText: "Lucía Gómez" })
    .getByRole("button", { name: "Ver entrega", exact: true })
    .click();
  const modal = teacher.getByRole("dialog");
  await expect(
    modal.getByRole("heading", { name: "Detalle de entrega" }),
  ).toBeVisible();
  const link = modal.getByRole("link", { name: "respuesta.pdf" });
  const url = await link.getAttribute("href");
  const downloaded = await teacher.request.get(url!);
  expect(downloaded.status()).toBe(200);
  expect((await downloaded.body()).toString()).toContain("%PDF");
  const preview = await modal
    .getByRole("link", { name: "Vista previa" })
    .getAttribute("href");
  expect(
    (await teacher.request.get(preview!)).headers()["content-disposition"],
  ).toContain("inline");
  await teacher.screenshot({
    path: "../evidence/submission-detail.png",
    fullPage: true,
  });
  await teacher.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  const listing = await teacher.request.get(`/api/tasks/${taskId}/submissions`);
  expect(
    (await listing.json()).some((r: any) => r.file_name === "respuesta.pdf"),
  ).toBeTruthy();
  await teacher.close();
  await student.close();
});

test("calendario: notas privadas de maestro y coordinador sin horarios globales del administrador", async ({
  browser,
}) => {
  const teacher = await browser.newPage(),
    coordinator = await browser.newPage(),
    admin = await browser.newPage();
  await login(teacher, "maestro");
  await nav(teacher, "Calendario");
  await teacher.getByRole("button", { name: "Agregar anotación" }).click();
  const title = `Anotación privada ${Date.now()}`;
  await teacher.getByLabel("Título", { exact: true }).fill(title);
  await teacher
    .getByLabel("Contenido", { exact: true })
    .fill("Revisar proyectos");
  await save(teacher);
  const note = teacher.locator(".agenda-row").filter({
    has: teacher.getByRole("heading", { name: title, exact: true }),
  });
  await expect(note).toBeVisible();
  await teacher.reload();
  await nav(teacher, "Calendario");
  await expect(note).toBeVisible();
  await login(coordinator, "coordinador");
  await nav(coordinator, "Calendario");
  await expect(
    coordinator.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0);
  await coordinator.getByRole("button", { name: "Agregar anotación" }).click();
  await coordinator
    .getByLabel("Título", { exact: true })
    .fill("Seguimiento de matrícula " + title);
  await save(coordinator);
  await expect(
    coordinator.getByRole("heading", {
      name: "Seguimiento de matrícula " + title,
    }),
  ).toBeVisible();
  await login(admin, "admin");
  await nav(admin, "Calendario");
  await expect(
    admin.getByRole("button", { name: "Ver asignatura" }),
  ).toHaveCount(0);
  await expect(
    admin.getByRole("button", { name: "Ver actividad" }),
  ).toHaveCount(0);
  await admin
    .getByRole("button", { name: "Crear evento institucional" })
    .click();
  await admin
    .getByLabel("Título", { exact: true })
    .fill("Reunión institucional " + title);
  await save(admin);
  await expect(
    admin.getByRole("heading", { name: "Reunión institucional " + title }),
  ).toBeVisible();
  await note.getByRole("button", { name: "Eliminar" }).click();
  await save(teacher);
  await expect(note).toHaveCount(0);
  await teacher.close();
  await coordinator.close();
  await admin.close();
});

test("coordinador registra alumnos y mueve bloques desde Gestión académica", async ({
  page,
}) => {
  await login(page, "coordinador");
  await nav(page, "Gestión académica");
  await page
    .getByRole("button", { name: "Registrar alumno", exact: true })
    .click();
  const name = `Alumno coordinado ${Date.now()}`;
  await page.getByLabel("Nombre completo").fill(name);
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill(`coordinado-${Date.now()}@aula.test`);
  await page
    .getByLabel("Contraseña temporal (12–72 caracteres)")
    .fill(password + "c");
  await page.getByLabel("Grupo", { exact: true }).selectOption("1");
  await save(page);
  await expect(
    page
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name, exact: true }) }),
  ).toBeVisible();
  await page.getByLabel("Docente del horario").selectOption("2");
  const monday = page
    .locator(".week-day")
    .filter({ has: page.getByRole("heading", { name: "Lunes", exact: true }) });
  await monday
    .locator(".schedule-card")
    .filter({ hasText: "Matemáticas" })
    .getByRole("button", { name: "Editar", exact: true })
    .click();
  await page.getByLabel("Hora de inicio").fill("07:00");
  await page.getByLabel("Hora final").fill("08:00");
  await save(page);
  await expect(monday.getByText("07:00 – 08:00")).toBeVisible();
  await page.screenshot({
    path: "../evidence/coordinator-management.png",
    fullPage: true,
  });
});

test("administrador matricula alumnos existentes y administra maestros", async ({
  page,
}) => {
  await login(page, "admin");
  const name = `Alumno pendiente ${Date.now()}`;
  const created = await mutation(page, "/users", {
    name,
    email: `pendiente-${Date.now()}@aula.test`,
    role: "STUDENT",
    password,
  });
  const studentId = (await created.json()).id;
  await page.reload();
  await nav(page, "Gestión académica");
  await page
    .locator(".group-line")
    .filter({
      has: page.getByRole("heading", { name: "Tercero A", exact: true }),
    })
    .getByRole("button", { name: "Matricular", exact: true })
    .click();
  await page
    .getByLabel("Alumno", { exact: true })
    .selectOption(String(studentId));
  await save(page);
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Agregar maestro", exact: true })
    .click();
  const teacher = `Docente de prueba ${Date.now()}`;
  await page.getByLabel("Nombre completo").fill(teacher);
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill(`docente-${Date.now()}@aula.test`);
  await page
    .getByLabel("Contraseña temporal (12–72 caracteres)")
    .fill(password);
  await save(page);
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: teacher, exact: true }) });
  await row.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill(teacher + " editado");
  await save(page);
  await page
    .getByRole("row")
    .filter({ hasText: teacher + " editado" })
    .getByRole("button", { name: "Desactivar", exact: true })
    .click();
  await save(page);
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: teacher + " editado" })
      .getByRole("cell", { name: "Inactivo", exact: true }),
  ).toBeVisible();
});

test("horario de administrador filtra por maestro, conserva modo oscuro y muestra recesos", async ({
  page,
}) => {
  await login(page, "admin");
  await nav(page, "Horario");
  await expect(page.locator(".schedule-card")).toHaveCount(0);
  await page.getByLabel("Buscar docente").fill("Ana");
  await page.getByLabel("Docente del horario").selectOption("2");
  await expect(
    page.locator(".schedule-card").filter({ hasText: "Matemáticas" }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Agregar receso", exact: true })
    .click();
  await page.getByLabel("Día", { exact: true }).selectOption("1");
  await page.getByLabel("Hora de inicio").fill("09:00");
  await page.getByLabel("Hora final").fill("09:30");
  await save(page);
  await expect(
    page.getByRole("heading", { name: "Receso", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Bloque libre", exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "../evidence/admin-schedule-dark.png",
    fullPage: true,
  });
  await page
    .locator(".schedule-card")
    .filter({ has: page.getByRole("heading", { name: "Receso", exact: true }) })
    .getByRole("button", { name: "Retirar", exact: true })
    .click();
  await save(page);
});

test("mensajería privada: coordinación docente y mensajes de administración de solo lectura", async ({
  browser,
}) => {
  const admin = await browser.newPage(),
    student = await browser.newPage(),
    teacher = await browser.newPage(),
    coordinator = await browser.newPage();
  await login(coordinator, "coordinador");
  await nav(coordinator, "Chat");
  await coordinator
    .getByLabel("Destinatario", { exact: true })
    .selectOption("2");
  await coordinator
    .getByRole("button", { name: "Abrir conversación privada" })
    .click();
  const secret = `Seguimiento docente ${Date.now()}`;
  await coordinator.getByLabel("Mensaje privado", { exact: true }).fill(secret);
  await coordinator
    .getByRole("button", { name: "Enviar mensaje privado", exact: true })
    .click();
  await expect(
    coordinator.locator(".message").getByText(secret, { exact: true }),
  ).toBeVisible();
  await login(teacher, "maestro");
  await nav(teacher, "Chat");
  await teacher
    .getByRole("button", { name: "Carlos Méndez", exact: true })
    .click();
  await expect(
    teacher.locator(".message").getByText(secret, { exact: true }),
  ).toBeVisible();
  await login(student, "alumno");
  await nav(student, "Chat");
  await login(admin, "admin");
  await nav(admin, "Chat");
  await admin.getByLabel("Buscar destinatario").fill("Lucía");
  await admin.getByLabel("Destinatario", { exact: true }).selectOption("3");
  await admin
    .getByRole("button", { name: "Abrir conversación privada" })
    .click();
  const message = `Aviso de administración ${Date.now()}`;
  await admin.getByLabel("Mensaje privado", { exact: true }).fill(message);
  await admin
    .getByRole("button", { name: "Enviar mensaje privado", exact: true })
    .click();
  await expect(
    admin.locator(".message").getByText(message, { exact: true }),
  ).toBeVisible();
  await expect(
    student.getByRole("button", { name: /Administr.*Solo lectura/ }),
  ).toBeVisible({ timeout: 10000 });
  await student
    .getByRole("button", { name: /Administr.*Solo lectura/ })
    .click();
  await expect(
    student.locator(".message").getByText(message, { exact: true }),
  ).toBeVisible();
  await expect(
    student.getByLabel("Mensaje privado", { exact: true }),
  ).toHaveCount(0);
  await expect(
    student.getByText("Solo lectura. No puedes responder a Administración."),
  ).toBeVisible();
  await expect(student.getByText(secret, { exact: true })).toHaveCount(0);
  const list = await (await student.request.get("/api/conversations")).json();
  const token = await (await student.request.get("/api/auth/csrf")).json();
  const denied = await student.request.post(
    `/api/conversations/${list[0].id}/messages`,
    {
      headers: { "X-XSRF-TOKEN": token.token },
      data: { body: "Respuesta manipulada" },
    },
  );
  expect(denied.status()).toBe(403);
  await student.screenshot({
    path: "../evidence/student-private-readonly.png",
    fullPage: true,
  });
  await admin.close();
  await student.close();
  await teacher.close();
  await coordinator.close();
});

test("administrador con rol Maestro accede únicamente a sus materias asignadas", async ({
  browser,
}) => {
  const admin = await browser.newPage(),
    dual = await browser.newPage();
  await login(admin, "admin");
  const stamp = Date.now(),
    email = `admin-docente-${stamp}@aula.test`;
  const user = await (
    await mutation(admin, "/users", {
      name: "Administrador docente",
      email,
      role: "ADMIN",
      password,
    })
  ).json();
  await admin.reload();
  await nav(admin, "Usuarios");
  await admin
    .getByRole("row")
    .filter({ has: admin.getByRole("cell", { name: email, exact: true }) })
    .getByRole("button", { name: "Roles", exact: true })
    .click();
  await admin.getByLabel("También es maestro").check();
  await save(admin);
  const subject = await (
    await mutation(admin, "/catalog/subject", {
      name: `Materia dual ${stamp}`,
      color: "#336699",
    })
  ).json();
  const course = await (
    await mutation(admin, "/courses", {
      subjectId: subject.id,
      groupId: 2,
      teacherId: user.id,
    })
  ).json();
  await dual.goto("/");
  await dual.getByLabel("Correo electrónico").fill(email);
  await dual.getByLabel("Contraseña", { exact: true }).fill(password);
  await dual.getByRole("button", { name: "Entrar a mi aula" }).click();
  await dual
    .getByRole("button", { name: "Cambiar contraseña", exact: true })
    .click();
  await dual.getByLabel("Contraseña actual").fill(password);
  await dual
    .getByLabel("Nueva contraseña (12–72 caracteres)")
    .fill(password + "D");
  await save(dual);
  await expect(dual.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await expect(dual.locator(".course-card")).toHaveCount(1);
  await expect(dual.locator(".course-card")).toContainText(
    `Materia dual ${stamp}`,
  );
  await expect(
    dual.getByRole("button", { name: "Actividades", exact: true }),
  ).toBeVisible();
  await expect(
    dual.getByRole("button", { name: "Reportes", exact: true }),
  ).toBeVisible();
  expect((await dual.request.get("/api/courses/1/tasks")).status()).toBe(403);
  expect(
    (await dual.request.get(`/api/courses/${course.id}/tasks`)).status(),
  ).toBe(200);
  expect(
    (await admin.request.get(`/api/courses/${course.id}/tasks`)).status(),
  ).toBe(403);
  await nav(dual, "Calendario");
  await expect(
    dual.getByRole("button", { name: "Ver asignatura" }),
  ).toHaveCount(0);
  await admin.close();
  await dual.close();
});
