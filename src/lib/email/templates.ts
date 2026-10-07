import { APP_CONFIG } from "@/config/app";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const NAVY = "#252F7E";
const BURGUNDY = "#A3263F";

function escape(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(opts: { preheader: string; title: string; paragraphs: string[]; cta?: { label: string; url: string }; footnote?: string }) {
  const paragraphs = opts.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151">${p}</p>`).join("");
  const cta = opts.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td style="border-radius:10px;background:${NAVY}">
         <a href="${escape(opts.cta.url)}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;letter-spacing:.04em;color:#ffffff;text-decoration:none">${escape(opts.cta.label)}</a>
       </td></tr></table>
       <p style="margin:0 0 16px;font-size:12px;color:#6b7280">Se o botão não funcionar, copie e cole este endereço no navegador:<br><span style="word-break:break-all;color:${NAVY}">${escape(opts.cta.url)}</span></p>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escape(opts.preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f8;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="padding:24px 32px;border-bottom:3px solid ${BURGUNDY}">
  <span style="font-size:18px;font-weight:700;color:${NAVY}">${APP_CONFIG.name}</span><br>
  <span style="font-size:12px;color:#6b7280">${APP_CONFIG.tagline}</span>
</td></tr>
<tr><td style="padding:32px">
  <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#111827">${escape(opts.title)}</h1>
  ${paragraphs}${cta}
  ${opts.footnote ? `<p style="margin:24px 0 0;font-size:12px;color:#9ca3af">${opts.footnote}</p>` : ""}
</td></tr>
</table>
<p style="font-size:11px;color:#9ca3af;margin:16px 0 0">Mensagem automática da ${APP_CONFIG.name}. Não responda este e-mail.</p>
</td></tr></table></body></html>`;
}

function text(title: string, lines: string[], url?: string) {
  return [title, "", ...lines.map((l) => l.replace(/<[^>]+>/g, "")), url ? `\n${url}` : ""].join("\n");
}

export const emailTemplates = {
  invite(p: { name: string; url: string }): EmailContent {
    const paragraphs = [
      `Olá, <strong>${escape(p.name)}</strong>!`,
      `Você foi convidado para a <strong>Universidade Corporativa ${APP_CONFIG.company}</strong>. Lá você encontra sua trilha de formação, aulas, materiais e provas.`,
      "Clique no botão abaixo para criar sua senha e acessar a plataforma. Por segurança, o link expira em 24 horas.",
    ];
    return {
      subject: "Você foi convidado para a Universidade Corporativa",
      html: layout({ preheader: "Crie sua senha e comece sua trilha.", title: "Bem-vindo(a) à Academy 👋", paragraphs, cta: { label: "ACESSAR PLATAFORMA", url: p.url }, footnote: "Se você não esperava este convite, ignore esta mensagem." }),
      text: text("Você foi convidado para a Universidade Corporativa", paragraphs, p.url),
    };
  },
  passwordReset(p: { name: string; url: string }): EmailContent {
    const paragraphs = [
      `Olá, <strong>${escape(p.name)}</strong>.`,
      "Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para criar uma nova senha. O link expira em 1 hora.",
    ];
    return {
      subject: "Redefinição de senha — Connect Skin Academy",
      html: layout({ preheader: "Crie uma nova senha.", title: "Redefinir senha", paragraphs, cta: { label: "REDEFINIR SENHA", url: p.url }, footnote: "Se você não pediu a redefinição, ignore este e-mail — sua senha atual continua válida." }),
      text: text("Redefinir senha", paragraphs, p.url),
    };
  },
  newModule(p: { name: string; moduleTitle: string; url: string }): EmailContent {
    const paragraphs = [`Olá, <strong>${escape(p.name)}</strong>!`, `O módulo <strong>${escape(p.moduleTitle)}</strong> já está disponível na sua trilha.`];
    return {
      subject: `Novo módulo disponível: ${p.moduleTitle}`,
      html: layout({ preheader: "Um novo módulo foi liberado.", title: "📚 Novo módulo liberado", paragraphs, cta: { label: "COMEÇAR AGORA", url: p.url } }),
      text: text("Novo módulo liberado", paragraphs, p.url),
    };
  },
  examPending(p: { name: string; exams: string[]; url: string }): EmailContent {
    const list = p.exams.map((e) => `• ${escape(e)}`).join("<br>");
    const paragraphs = [`Olá, <strong>${escape(p.name)}</strong>!`, "Você concluiu as aulas e tem prova(s) aguardando:", list];
    return {
      subject: "Você tem uma prova pendente",
      html: layout({ preheader: "Finalize seu módulo com a prova.", title: "📝 Prova pendente", paragraphs, cta: { label: "FAZER PROVA", url: p.url } }),
      text: text("Prova pendente", paragraphs, p.url),
    };
  },
  examResult(p: { name: string; examTitle: string; score: number; passed: boolean; attempt: number; maxAttempts: number | null; url: string }): EmailContent {
    const paragraphs = p.passed
      ? [`Parabéns, <strong>${escape(p.name)}</strong>!`, `Você foi <strong>aprovado</strong> na prova <strong>${escape(p.examTitle)}</strong> com nota <strong>${p.score}%</strong>.`]
      : [
          `Olá, <strong>${escape(p.name)}</strong>.`,
          `Você obteve <strong>${p.score}%</strong> na prova <strong>${escape(p.examTitle)}</strong> e ainda não atingiu a nota mínima.`,
          `Tentativa ${p.attempt}${p.maxAttempts ? ` de ${p.maxAttempts}` : ""}. Revise o conteúdo e tente novamente.`,
        ];
    return {
      subject: p.passed ? `Aprovado: ${p.examTitle} ✓` : `Resultado: ${p.examTitle}`,
      html: layout({ preheader: p.passed ? "Você foi aprovado!" : "Veja seu resultado.", title: p.passed ? "✅ Aprovado!" : "Resultado da prova", paragraphs, cta: { label: "VER RESULTADO", url: p.url } }),
      text: text("Resultado da prova", paragraphs, p.url),
    };
  },
  courseCompleted(p: { name: string; courseTitle: string; url: string }): EmailContent {
    const paragraphs = [`Parabéns, <strong>${escape(p.name)}</strong>! 🎓`, `Você concluiu a trilha <strong>${escape(p.courseTitle)}</strong>. Seu certificado já está disponível.`];
    return {
      subject: `Trilha concluída: ${p.courseTitle} 🎓`,
      html: layout({ preheader: "Seu certificado está disponível.", title: "Trilha concluída!", paragraphs, cta: { label: "VER CERTIFICADO", url: p.url } }),
      text: text("Trilha concluída", paragraphs, p.url),
    };
  },
  studyReminder(p: { name: string; days: number; percent: number; url: string }): EmailContent {
    const paragraphs = [
      `Olá, <strong>${escape(p.name)}</strong>!`,
      `Sentimos sua falta — seu último acesso foi há ${p.days} dias. Você já concluiu <strong>${Math.round(p.percent)}%</strong> da sua trilha.`,
      "Que tal reservar 15 minutos hoje para avançar?",
    ];
    return {
      subject: "Continue sua trilha na Academy",
      html: layout({ preheader: "Continue de onde parou.", title: "Continue de onde parou", paragraphs, cta: { label: "CONTINUAR ESTUDANDO", url: p.url } }),
      text: text("Continue de onde parou", paragraphs, p.url),
    };
  },
  announcement(p: { title: string; body: string; url: string }): EmailContent {
    const paragraphs = escape(p.body).split(/\n{2,}/).map((x) => x.replace(/\n/g, "<br>"));
    return {
      subject: `📢 ${p.title}`,
      html: layout({ preheader: p.title, title: p.title, paragraphs, cta: { label: "ABRIR NA PLATAFORMA", url: p.url } }),
      text: text(p.title, [p.body], p.url),
    };
  },
};

export type EmailTemplateId = keyof typeof emailTemplates;
