import { test, expect, Page } from "@playwright/test";
const password = process.env.E2E_PASSWORD;
test("calendario académico permite consultar fechas y navegar por mes", async ({
  page,
}) => {
  await login(page, "alumno@aula.test");
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  expect(await page.locator(".calendar-day").count()).toBeGreaterThanOrEqual(
    28,
  );
  await expect(page.getByRole("heading", { name: /Agenda del/ })).toBeVisible();
  const monthTitle = await page.locator(".panel h2").first().textContent();
  await page.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(page.locator(".panel h2").first()).not.toHaveText(monthTitle!);
  await page.getByRole("button", { name: "Hoy", exact: true }).click();
  await expect(page.locator(".current-day")).toBeVisible();
  await page.screenshot({ path: "../evidence/calendar.png", fullPage: true });
});
test.beforeEach(async () => {
  expect(
    password,
    "Define E2E_PASSWORD con la contraseña del entorno de prueba.",
  ).toBeTruthy();
});
async function login(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Entrar a mi aula" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
}
test("acceso unificado y dashboard de los cuatro roles", async ({ page }) => {
  for (const who of ["alumno", "maestro", "coordinador", "admin"]) {
    await login(page, `${who}@aula.test`);
    if (["alumno", "maestro"].includes(who)) {
      await expect(
        page.getByRole("heading", { name: /Mis asignaturas/ }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: /Mis asignaturas/ }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Actividades", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Reportes", exact: true }),
      ).toHaveCount(0);
      if (who === "coordinador")
        await expect(
          page.getByRole("button", { name: "Horario", exact: true }),
        ).toHaveCount(0);
    }
    if (who === "alumno")
      await expect(
        page.getByRole("button", { name: "Usuarios", exact: true }),
      ).toHaveCount(0);
    if (who === "admin") {
      await page.getByRole("button", { name: "Usuarios", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Comunidad educativa" }),
      ).toBeVisible();
    }
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(
      page.getByRole("button", { name: "Entrar a mi aula" }),
    ).toBeVisible();
  }
});
test("alumno envía enlace y maestro califica la entrega", async ({
  browser,
}) => {
  const student = await browser.newPage(),
    teacher = await browser.newPage();
  await login(teacher, "maestro@aula.test");
  await teacher
    .getByRole("button", { name: "Asignaturas", exact: true })
    .click();
  await teacher
    .getByRole("button")
    .filter({
      has: teacher.getByRole("heading", { name: "Matemáticas", exact: true }),
    })
    .click();
  await teacher
    .getByRole("button", { name: "Nueva actividad", exact: true })
    .click();
  const title = `Actividad navegador ${Date.now()}`;
  await teacher.getByLabel("Título", { exact: true }).fill(title);
  await teacher
    .getByLabel("Instrucciones")
    .fill("Comparte tu procedimiento con ejemplos.");
  const due = new Date(Date.now() + 86400000);
  await teacher
    .getByLabel("Fecha límite")
    .fill(
      new Date(due.getTime() - due.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
    );
  await teacher.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(teacher.getByRole("dialog")).toHaveCount(0);
  await login(student, "alumno@aula.test");
  await student
    .getByRole("button", { name: "Actividades", exact: false })
    .filter({ has: student.locator("svg") })
    .first()
    .click();
  const task = student.locator(".task-row").filter({
    has: student.getByRole("heading", { name: title, exact: true }),
  });
  await task.getByRole("button", { name: "Entregar", exact: true }).click();
  await student
    .getByLabel("Enlace a tu trabajo")
    .fill("https://example.org/mi-trabajo");
  await student.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(task.getByText("Entregada", { exact: true })).toBeVisible();
  const review = teacher.locator(".task-row").filter({
    has: teacher.getByRole("heading", { name: title, exact: true }),
  });
  await review.getByRole("button", { name: /Ver entregas/ }).click();
  const row = teacher.getByRole("row").filter({ hasText: "Lucía Gómez" });
  await row.getByRole("button", { name: "Calificar", exact: true }).click();
  await teacher.getByLabel("Nota", { exact: true }).fill("95");
  await teacher
    .getByLabel("Observaciones")
    .fill("Procedimiento verificado en navegador.");
  await teacher.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    row.getByRole("cell", { name: "95", exact: true }),
  ).toBeVisible();
  await student.reload();
  await expect(student.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await student
    .getByRole("button", { name: "Actividades", exact: false })
    .filter({ has: student.locator("svg") })
    .first()
    .click();
  await expect(
    student
      .locator(".task-row")
      .filter({ hasText: title })
      .getByText("95 / 100"),
  ).toBeVisible();
  await student.close();
  await teacher.close();
});
test("chat persistente, modo oscuro y vista móvil sin desbordamiento", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "alumno@aula.test");
  await expect(page.locator(".course-card")).toHaveCount(4);
  await page.screenshot({
    path: "../evidence/mobile-dashboard.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page
    .getByRole("button")
    .filter({
      has: page.getByRole("heading", { name: "Matemáticas", exact: true }),
    })
    .click();
  const message = `Mensaje de prueba ${Date.now()}`;
  await page.getByLabel("Escribe un mensaje").fill(message);
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(
    page.locator(".message").getByText(message, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("administración crea usuario con contraseña temporal y registra auditoría", async ({
  page,
}) => {
  await login(page, "admin@aula.test");
  await page.getByRole("button", { name: "Usuarios", exact: true }).click();
  await page
    .getByRole("button", { name: "Crear usuario", exact: true })
    .click();
  const email = `nuevo-${Date.now()}@aula.test`;
  await page.getByLabel("Nombre completo").fill("Usuario de verificación");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Rol", { exact: true }).selectOption("STUDENT");
  await page
    .getByLabel("Contraseña temporal (12–72 caracteres)")
    .fill(password! + "x");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: email, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Auditoría", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "CREATE_USER", exact: true }).first(),
  ).toBeVisible();
});
test("captura de escritorio y materiales reales", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "alumno@aula.test");
  await expect(page.locator(".course-card")).toHaveCount(4);
  await page.screenshot({ path: "../evidence/dashboard.png", fullPage: true });
  await page.getByRole("button", { name: "Asignaturas", exact: true }).click();
  await page
    .getByRole("button")
    .filter({
      has: page.getByRole("heading", { name: "Matemáticas", exact: true }),
    })
    .click();
  await page.getByRole("button", { name: "Materiales", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Guía de aprendizaje", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  await page.screenshot({
    path: "../evidence/dark-materials.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
