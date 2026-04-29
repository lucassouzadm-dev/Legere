
import { User } from '../types';

/**
 * Serviço de Notificação OLS - MODO PRODUÇÃO
 * Este serviço dispara e-mails reais via API ou simula o disparo no console.
 */

export const sendNotificationEmail = async (params: {
  to: string;
  subject: string;
  body: string;
  type: 'MENTION' | 'CHAT' | 'DEADLINE' | 'EVENT';
}) => {
  const timestamp = new Date().toLocaleString('pt-BR');
  
  // LOG DE AUDITORIA (Visível no F12 -> Console)
  console.info(`[SISTEMA OLS] Acionando notificação: ${params.type}`);
  console.info(`[SISTEMA OLS] Para: ${params.to}`);
  console.info(`[SISTEMA OLS] Assunto: ${params.subject}`);

  const emailHtml = `
    <div style="font-family: sans-serif; color: #1e293b; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
      <h2 style="color: #1e3a8a; margin-top: 0;">Legere</h2>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
      <p style="font-size: 16px; line-height: 1.6;">${params.body}</p>
      <br />
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; font-size: 12px; color: #64748b;">
         <strong>Aviso Automático:</strong> Este é um e-mail gerado pelo sistema de gestão interna OLS ERP. Não responda a este endereço.
      </div>
      <p style="font-size: 10px; color: #94a3b8; margin-top: 20px;">Protocolo: ${params.type}_${Date.now()} | Gerado em ${timestamp}</p>
    </div>
  `;

  // --- CONFIGURAÇÃO DA API ---
  const API_KEY = 'mlsn.57a76c3b7cbc0e8037470590fe51c5f4388b2a4158117d7b7e94c29215640bfb'; // Substitua pela sua chave real (ex: Resend)
  
  if (API_KEY === 'mlsn.57a76c3b7cbc0e8037470590fe51c5f4388b2a4158117d7b7e94c29215640bfb') {
    console.warn("⚠️ SISTEMA: API Key de e-mail não configurada. Disparo SIMULADO com sucesso no console.");
    console.group(`📧 Conteúdo da Notificação (${params.type})`);
    console.log(`Para: ${params.to}`);
    console.log(`Assunto: ${params.subject}`);
    console.log(`Mensagem: ${params.body}`);
    console.groupEnd();
    return true; 
  }

  try {
    const response = await fetch('https://api.resend.com/emails', { 
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${API_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        from: "OLS ERP <lucassouza@olsadvogados.com.br>",
        to: [params.to],
        subject: `[OLS ERP] ${params.subject}`,
        html: emailHtml
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ SISTEMA: Erro na API de E-mail:", errorData);
      return false;
    }

    console.log("✅ SISTEMA: E-mail enviado com sucesso via API!");
    return true;
  } catch (error) {
    console.error("❌ SISTEMA: Falha crítica na conexão com o provedor de e-mail:", error);
    return false;
  }
};
