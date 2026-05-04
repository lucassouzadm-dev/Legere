/**
 * exportService.ts
 * Serviço de exportação de dados em PDF (casos, prazos) e Excel (financeiro)
 * PDF via pdfmake (sem vulnerabilidades); Excel via ExcelJS.
 */

// Status map PT-BR
const STATUS_MAP: Record<string, string> = {
  'ONGOING': 'Em Curso',
  'WON': 'Procedente',
  'LOST': 'Improcedente',
  'SETTLEMENT': 'Acordo',
  'SUSPENDED': 'Suspenso',
  'ARCHIVED': 'Arquivado',
};

const URGENCY_MAP: Record<string, string> = {
  'URGENT': 'Fatal',
  'HIGH': 'Alta',
  'MEDIUM': 'Média',
  'LOW': 'Baixa',
};

// ─── Helper: carrega pdfmake com fontes ───────────────────────────────────────
async function getPdfMake() {
  const pdfMake   = (await import('pdfmake/build/pdfmake')).default;
  const pdfFonts  = (await import('pdfmake/build/vfs_fonts')).default;
  pdfMake.vfs = pdfFonts.vfs ?? (pdfFonts as any).pdfMake?.vfs;
  return pdfMake;
}

// ─── Estilos compartilhados ───────────────────────────────────────────────────
const PDF_STYLES: any = {
  title:    { fontSize: 16, bold: true, color: '#1E3A8A', alignment: 'center', margin: [0, 0, 0, 4] },
  subtitle: { fontSize: 9,  color: '#6B7280', alignment: 'center', margin: [0, 0, 0, 14] },
  footer:   { fontSize: 8,  color: '#9CA3AF' },
  tableHeader: { bold: true, fontSize: 9, color: '#FFFFFF', fillColor: '#1E3A8A', alignment: 'center' },
};

function pdfFooter(currentPage: number, pageCount: number, info: string) {
  return {
    columns: [
      { text: info, style: 'footer', margin: [40, 0, 0, 0] },
      { text: `Página ${currentPage} de ${pageCount}`, style: 'footer', alignment: 'right', margin: [0, 0, 40, 0] },
    ],
    margin: [0, 4],
  };
}

/**
 * Exporta lista de processos para PDF com tabela formatada
 */
export async function exportCasesPDF(cases: any[], users: any[], tenantName: string): Promise<void> {
  try {
    const pdfMake = await getPdfMake();
    const now     = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const totalValue = cases.reduce((sum, c) => sum + (c.value || 0), 0);
    const totalFmt   = `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const tableBody: any[][] = [
      // Cabeçalho da tabela
      ['CNJ', 'Cliente', 'Parte Contrária', 'Área', 'Tribunal', 'Advogado', 'Status', 'Valor'].map(h => ({
        text: h, style: 'tableHeader',
      })),
      // Linhas de dados
      ...cases.map((c, i) => {
        const fill = i % 2 === 0 ? '#FFFFFF' : '#F3F4F6';
        const fmt  = (v: any) => ({ text: String(v ?? 'N/A'), fontSize: 8, fillColor: fill });
        return [
          fmt(c.cnj),
          fmt(c.clientName),
          fmt(c.opposingParty || '—'),
          fmt(c.area),
          fmt(c.court || '—'),
          fmt(users.find((u: any) => u.id === c.lawyerId)?.name ?? '—'),
          fmt(STATUS_MAP[c.status] ?? c.status),
          { text: `R$ ${(c.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, fontSize: 8, fillColor: fill },
        ];
      }),
    ];

    const docDef: any = {
      pageOrientation: 'landscape',
      pageMargins: [30, 50, 30, 40],
      styles: PDF_STYLES,
      footer: (cur: number, total: number) =>
        pdfFooter(cur, total, `Total: ${cases.length} processos | Valor total: ${totalFmt}`),
      content: [
        { text: tenantName, style: 'title' },
        { text: `Relatório de Processos  |  Gerado em ${dateStr}`, style: 'subtitle' },
        {
          table: {
            headerRows: 1,
            widths: [75, 60, 60, 45, 55, 50, 35, 40],
            body: tableBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#E5E7EB',
          },
        },
      ],
    };

    const fname = `processos-${tenantName.replace(/\s+/g, '-').toLowerCase()}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.pdf`;
    pdfMake.createPdf(docDef).download(fname);
  } catch (error) {
    console.error('Erro ao exportar PDF de processos:', error);
    alert('Erro ao gerar PDF de processos. Tente novamente.');
  }
}

/**
 * Exporta lista de prazos para PDF com destaque em cores por urgência
 */
export async function exportDeadlinesPDF(deadlines: any[], tenantName: string): Promise<void> {
  try {
    const pdfMake = await getPdfMake();
    const now     = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = deadlines
      .filter(d => d.status !== 'DONE')
      .sort((a, b) => new Date(a.date + 'T00:00:00').getTime() - new Date(b.date + 'T00:00:00').getTime());

    function rowFill(diffDays: number): string {
      if (diffDays < 0)  return '#FEE2E2'; // vencido → vermelho claro
      if (diffDays <= 1) return '#FECACA'; // fatal    → vermelho médio
      if (diffDays <= 5) return '#FEF3C7'; // urgente  → amarelo
      return '#FFFFFF';
    }

    const tableBody: any[][] = [
      ['Tipo / Prazo', 'Processo', 'Vencimento', 'Urgência', 'Responsável', 'Dias'].map(h => ({
        text: h, style: 'tableHeader',
      })),
      ...pending.map(d => {
        const dl      = new Date(d.date + 'T00:00:00');
        const diffMs  = dl.getTime() - today.getTime();
        const diffD   = Math.ceil(diffMs / 86_400_000);
        const fill    = rowFill(diffD);
        const daysLbl = diffD < 0 ? `${Math.abs(diffD)}d atraso` : diffD === 0 ? 'HOJE' : `${diffD}d`;
        const cell    = (v: any) => ({ text: String(v ?? '—'), fontSize: 8, fillColor: fill });
        return [
          cell(d.type),
          cell(d.case),
          cell(dl.toLocaleDateString('pt-BR')),
          cell(URGENCY_MAP[d.urgency] ?? d.urgency ?? '—'),
          cell(d.responsible),
          { text: daysLbl, fontSize: 8, bold: diffD <= 1, color: diffD < 0 ? '#DC2626' : '#111827', fillColor: fill },
        ];
      }),
    ];

    const docDef: any = {
      pageMargins: [30, 50, 30, 40],
      styles: PDF_STYLES,
      footer: (cur: number, total: number) =>
        pdfFooter(cur, total, `Total de prazos em aberto: ${pending.length}`),
      content: [
        { text: tenantName, style: 'title' },
        { text: `Relatório de Prazos  |  Gerado em ${dateStr}`, style: 'subtitle' },
        // Legenda de cores
        {
          columns: [
            { text: '■ Vencido', fontSize: 8, color: '#DC2626',  margin: [0, 0, 10, 10] },
            { text: '■ Fatal (≤1d)', fontSize: 8, color: '#EF4444', margin: [0, 0, 10, 10] },
            { text: '■ Urgente (≤5d)', fontSize: 8, color: '#D97706', margin: [0, 0, 10, 10] },
          ],
        },
        {
          table: {
            headerRows: 1,
            widths: [100, 90, 45, 40, 80, 35],
            body: tableBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#E5E7EB',
          },
        },
      ],
    };

    const fname = `prazos-${tenantName.replace(/\s+/g, '-').toLowerCase()}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.pdf`;
    pdfMake.createPdf(docDef).download(fname);
  } catch (error) {
    console.error('Erro ao exportar PDF de prazos:', error);
    alert('Erro ao gerar PDF de prazos. Tente novamente.');
  }
}

/**
 * Exporta transações financeiras para Excel com múltiplas abas
 * Usa ExcelJS (sem vulnerabilidades conhecidas)
 */
export async function exportFinanceExcel(transactions: any[], tenantName: string, period?: string): Promise<void> {
  try {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = tenantName;
    workbook.created = new Date();

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // ─── helpers ──────────────────────────────────────────────────────────────
    const NAVY  = { argb: 'FF1E3A8A' };
    const WHITE = { argb: 'FFFFFFFF' };
    const GREY  = { argb: 'FFF0F4F8' };
    const GREEN = { argb: 'FFD1FAE5' };
    const RED   = { argb: 'FFFEE2E2' };
    const BRL   = '"R$ "#,##0.00';

    function styleHeader(row: any) {
      row.eachCell((cell: any) => {
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: NAVY };
        cell.font   = { color: WHITE, bold: true, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFD4AF37' } },
        };
      });
      row.height = 22;
    }

    function stripeRow(row: any, index: number) {
      if (index % 2 === 0) {
        row.eachCell((cell: any) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: GREY };
        });
      }
    }

    // ─── ABA 1: EXTRATO ───────────────────────────────────────────────────────
    const wsExtract = workbook.addWorksheet('Extrato');
    wsExtract.columns = [
      { header: 'Data',                key: 'date',        width: 13 },
      { header: 'Descrição',           key: 'description', width: 32 },
      { header: 'Tipo',                key: 'type',        width: 12 },
      { header: 'Categoria',           key: 'category',    width: 22 },
      { header: 'Valor (R$)',          key: 'amount',      width: 16 },
      { header: 'Status',              key: 'status',      width: 13 },
      { header: 'Cliente/Responsável', key: 'client',      width: 22 },
    ];

    styleHeader(wsExtract.getRow(1));

    transactions.forEach((t, idx) => {
      const row = wsExtract.addRow({
        date:        new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR'),
        description: t.description || '',
        type:        t.type === 'IN' ? 'Receita' : 'Despesa',
        category:    t.category || 'N/A',
        amount:      Number(t.amount) || 0,
        status:      t.status || 'PENDING',
        client:      t.clientName || 'N/A',
      });

      // Formatar valor
      row.getCell('amount').numFmt = BRL;

      // Colorir linha por tipo
      const typeColor = t.type === 'IN' ? GREEN : RED;
      row.getCell('type').fill  = { type: 'pattern', pattern: 'solid', fgColor: typeColor };
      row.getCell('amount').fill = { type: 'pattern', pattern: 'solid', fgColor: typeColor };

      stripeRow(row, idx);
    });

    // Totalizadores ao fim
    const lastRow = transactions.length + 2;
    wsExtract.addRow({});
    const totalRow = wsExtract.addRow({
      description: 'TOTAL DO PERÍODO',
      amount: { formula: `SUM(E2:E${transactions.length + 1})` },
    });
    totalRow.getCell('description').font = { bold: true };
    totalRow.getCell('amount').numFmt    = BRL;
    totalRow.getCell('amount').font      = { bold: true };

    // ─── ABA 2: RESUMO MENSAL ─────────────────────────────────────────────────
    const wsSummary = workbook.addWorksheet('Resumo Mensal');
    wsSummary.columns = [
      { header: 'Mês',      key: 'month',   width: 13 },
      { header: 'Receitas', key: 'revenue',  width: 18 },
      { header: 'Despesas', key: 'expense',  width: 18 },
      { header: 'Saldo',    key: 'balance',  width: 18 },
    ];

    styleHeader(wsSummary.getRow(1));

    const monthlyData: Record<string, { revenue: number; expense: number }> = {};
    transactions.forEach(t => {
      const date = new Date(t.date + 'T00:00:00');
      const key  = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) monthlyData[key] = { revenue: 0, expense: 0 };
      if (t.type === 'IN') monthlyData[key].revenue += Number(t.amount) || 0;
      else monthlyData[key].expense += Number(t.amount) || 0;
    });

    Object.entries(monthlyData).sort().forEach(([month, data], idx) => {
      const balance = data.revenue - data.expense;
      const row = wsSummary.addRow({ month, revenue: data.revenue, expense: data.expense, balance });
      row.getCell('revenue').numFmt = BRL;
      row.getCell('expense').numFmt = BRL;
      row.getCell('balance').numFmt = BRL;
      row.getCell('balance').font   = { color: { argb: balance >= 0 ? 'FF16A34A' : 'FFDC2626' }, bold: true };
      stripeRow(row, idx);
    });

    // ─── ABA 3: POR CATEGORIA ─────────────────────────────────────────────────
    const wsCategory = workbook.addWorksheet('Por Categoria');
    wsCategory.columns = [
      { header: 'Categoria', key: 'category', width: 28 },
      { header: 'Receitas',  key: 'revenue',  width: 18 },
      { header: 'Despesas',  key: 'expense',  width: 18 },
    ];

    styleHeader(wsCategory.getRow(1));

    const catData: Record<string, { revenue: number; expense: number }> = {};
    transactions.forEach(t => {
      const cat = t.category || 'N/A';
      if (!catData[cat]) catData[cat] = { revenue: 0, expense: 0 };
      if (t.type === 'IN') catData[cat].revenue += Number(t.amount) || 0;
      else catData[cat].expense += Number(t.amount) || 0;
    });

    Object.entries(catData).sort().forEach(([category, data], idx) => {
      const row = wsCategory.addRow({ category, revenue: data.revenue, expense: data.expense });
      row.getCell('revenue').numFmt = BRL;
      row.getCell('expense').numFmt = BRL;
      stripeRow(row, idx);
    });

    // ─── Gerar arquivo e baixar ───────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob   = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `financeiro-${tenantName.replace(/\s+/g, '-').toLowerCase()}-${dateStr}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Erro ao exportar Excel de financeiro:', error);
    alert('Erro ao gerar Excel de financeiro. Tente novamente.');
  }
}

// ─── Mapa de status audiências ────────────────────────────────────────────────
const HEARING_STATUS_MAP: Record<string, string> = {
  SCHEDULED: 'Agendada',
  COMPLETED: 'Realizada',
  CANCELLED: 'Cancelada',
  POSTPONED: 'Adiada',
};
const HEARING_MODAL_MAP: Record<string, string> = {
  PRESENCIAL:       'Presencial',
  VIDEOCONFERENCIA: 'Videoconferência',
  HIBRIDA:          'Híbrida',
};

/**
 * Exporta lista de audiências para PDF com destaque por proximidade
 */
export async function exportHearingsPDF(hearings: any[], users: any[], tenantName: string): Promise<void> {
  try {
    const pdfMake = await getPdfMake();
    const now     = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const today   = new Date(); today.setHours(0, 0, 0, 0);

    const sorted = [...hearings].sort((a, b) =>
      new Date(`${a.date}T${a.time || '00:00'}`).getTime() -
      new Date(`${b.date}T${b.time || '00:00'}`).getTime()
    );

    function rowFill(diffDays: number, status: string): string {
      if (status === 'CANCELLED') return '#F3F4F6';
      if (status === 'COMPLETED') return '#D1FAE5';
      if (diffDays < 0)  return '#FEE2E2';
      if (diffDays <= 1) return '#FECACA';
      if (diffDays <= 7) return '#FEF3C7';
      return '#FFFFFF';
    }

    const tableBody: any[][] = [
      ['Data / Hora', 'Processo', 'Partes', 'Modalidade', 'Local / Link', 'Responsável', 'Status'].map(h => ({
        text: h, style: 'tableHeader',
      })),
      ...sorted.map((h, i) => {
        const hDate   = new Date(`${h.date}T${h.time || '00:00'}:00`);
        const diffMs  = hDate.getTime() - today.getTime();
        const diffD   = Math.ceil(diffMs / 86_400_000);
        const fill    = rowFill(diffD, h.status);
        const respName = users.find((u: any) => u.id === h.responsibleId)?.name ?? h.responsibleName ?? '—';
        const localLink = h.modality === 'VIDEOCONFERENCIA' ? (h.link || '—') : (h.location || '—');
        const dateFmt = h.date
          ? new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR') + (h.time ? ` ${h.time}` : '')
          : '—';
        const cell = (v: any) => ({ text: String(v ?? '—'), fontSize: 8, fillColor: fill });
        return [
          cell(dateFmt),
          cell(h.processNumber || '—'),
          cell(h.parties || h.clientName || '—'),
          cell(HEARING_MODAL_MAP[h.modality] ?? h.modality ?? '—'),
          cell(localLink),
          cell(respName),
          { text: HEARING_STATUS_MAP[h.status] ?? h.status ?? '—', fontSize: 8, bold: h.status === 'SCHEDULED', fillColor: fill },
        ];
      }),
    ];

    const agendadas = hearings.filter(h => h.status === 'SCHEDULED').length;

    const docDef: any = {
      pageOrientation: 'landscape',
      pageMargins: [30, 50, 30, 40],
      styles: PDF_STYLES,
      footer: (cur: number, total: number) =>
        pdfFooter(cur, total, `Total: ${hearings.length} audiências | Agendadas: ${agendadas}`),
      content: [
        { text: tenantName, style: 'title' },
        { text: `Relatório de Audiências  |  Gerado em ${dateStr}`, style: 'subtitle' },
        {
          columns: [
            { text: '■ Realizada', fontSize: 8, color: '#16A34A', margin: [0, 0, 10, 10] },
            { text: '■ Vencida',   fontSize: 8, color: '#DC2626', margin: [0, 0, 10, 10] },
            { text: '■ Amanhã',    fontSize: 8, color: '#EF4444', margin: [0, 0, 10, 10] },
            { text: '■ Esta semana', fontSize: 8, color: '#D97706', margin: [0, 0, 10, 10] },
            { text: '■ Cancelada', fontSize: 8, color: '#9CA3AF', margin: [0, 0, 10, 10] },
          ],
        },
        {
          table: {
            headerRows: 1,
            widths: [60, 80, 80, 55, 80, 70, 40],
            body: tableBody,
          },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => '#E5E7EB' },
        },
      ],
    };

    const slug  = tenantName.replace(/\s+/g, '-').toLowerCase();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    pdfMake.createPdf(docDef).download(`audiencias-${slug}-${stamp}.pdf`);
  } catch (error) {
    console.error('Erro ao exportar PDF de audiências:', error);
    alert('Erro ao gerar PDF de audiências. Tente novamente.');
  }
}

// ─── Mapa de status clientes ──────────────────────────────────────────────────
const CLIENT_STATUS_MAP: Record<string, string> = {
  LEAD:            'Lead',
  PROSPECT:        'Prospecto',
  CONTRACT_SENT:   'Contrato Enviado',
  ACTIVE:          'Ativo',
  INACTIVE:        'Inativo',
  EX_CLIENT:       'Ex-Cliente',
};

/**
 * Exporta base de clientes para PDF
 */
export async function exportClientsPDF(clients: any[], tenantName: string): Promise<void> {
  try {
    const pdfMake = await getPdfMake();
    const now     = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');

    const STATUS_FILL: Record<string, string> = {
      ACTIVE:         '#D1FAE5',
      LEAD:           '#DBEAFE',
      PROSPECT:       '#EDE9FE',
      CONTRACT_SENT:  '#FEF3C7',
      INACTIVE:       '#F3F4F6',
      EX_CLIENT:      '#FEE2E2',
    };

    const tableBody: any[][] = [
      ['Nome', 'CPF / CNPJ', 'Status', 'Telefone', 'E-mail', 'Processos', 'Total Pago'].map(h => ({
        text: h, style: 'tableHeader',
      })),
      ...clients.map(c => {
        const fill = STATUS_FILL[c.status] ?? '#FFFFFF';
        const cell = (v: any) => ({ text: String(v ?? '—'), fontSize: 8, fillColor: fill });
        const totalPaid = c.totalPaid
          ? `R$ ${Number(c.totalPaid).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : 'R$ 0,00';
        return [
          cell(c.name),
          cell(c.document || '—'),
          { text: CLIENT_STATUS_MAP[c.status] ?? c.status ?? '—', fontSize: 8, bold: true, fillColor: fill },
          cell(c.phone || '—'),
          cell(c.email || '—'),
          cell(c.caseCount ?? '—'),
          cell(totalPaid),
        ];
      }),
    ];

    const ativos = clients.filter(c => c.status === 'ACTIVE').length;

    const docDef: any = {
      pageOrientation: 'landscape',
      pageMargins: [30, 50, 30, 40],
      styles: PDF_STYLES,
      footer: (cur: number, total: number) =>
        pdfFooter(cur, total, `Total de clientes: ${clients.length} | Ativos: ${ativos}`),
      content: [
        { text: tenantName, style: 'title' },
        { text: `Relatório de Clientes  |  Gerado em ${dateStr}`, style: 'subtitle' },
        {
          table: {
            headerRows: 1,
            widths: [90, 60, 45, 55, 90, 30, 50],
            body: tableBody,
          },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => '#E5E7EB' },
        },
      ],
    };

    const slug  = tenantName.replace(/\s+/g, '-').toLowerCase();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    pdfMake.createPdf(docDef).download(`clientes-${slug}-${stamp}.pdf`);
  } catch (error) {
    console.error('Erro ao exportar PDF de clientes:', error);
    alert('Erro ao gerar PDF de clientes. Tente novamente.');
  }
}

/**
 * Exporta base de clientes para Excel com formatação profissional
 */
export async function exportClientsExcel(clients: any[], tenantName: string): Promise<void> {
  try {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = tenantName;
    workbook.created = new Date();

    const now     = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const NAVY    = { argb: 'FF1E3A8A' };
    const WHITE   = { argb: 'FFFFFFFF' };
    const BRL     = '"R$ "#,##0.00';

    const ws = workbook.addWorksheet('Clientes');
    ws.columns = [
      { header: 'Nome',           key: 'name',        width: 32 },
      { header: 'CPF / CNPJ',     key: 'document',    width: 20 },
      { header: 'Status',         key: 'status',      width: 18 },
      { header: 'Telefone',       key: 'phone',       width: 18 },
      { header: 'E-mail',         key: 'email',       width: 30 },
      { header: 'Endereço',       key: 'address',     width: 32 },
      { header: 'Tipo',           key: 'type',        width: 14 },
      { header: 'Processos',      key: 'caseCount',   width: 12 },
      { header: 'Total Pago',     key: 'totalPaid',   width: 18 },
      { header: 'Último Contato', key: 'lastContact', width: 18 },
      { header: 'Observações',    key: 'notes',       width: 36 },
    ];

    // Estilo do cabeçalho
    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: NAVY };
      cell.font   = { bold: true, color: WHITE, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FFCB9D1B' } } };
    });
    headerRow.height = 22;

    const STATUS_FILL_ARG: Record<string, string> = {
      ACTIVE:        'FFD1FAE5',
      LEAD:          'FFDBEAFE',
      PROSPECT:      'FFEDE9FE',
      CONTRACT_SENT: 'FFFEF3C7',
      INACTIVE:      'FFF3F4F6',
      EX_CLIENT:     'FFFEE2E2',
    };

    clients.forEach((c, idx) => {
      const row = ws.addRow({
        name:        c.name ?? '',
        document:    c.document ?? '',
        status:      CLIENT_STATUS_MAP[c.status] ?? c.status ?? '',
        phone:       c.phone ?? '',
        email:       c.email ?? '',
        address:     c.address ?? '',
        type:        c.type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física',
        caseCount:   c.caseCount ?? 0,
        totalPaid:   Number(c.totalPaid) || 0,
        lastContact: c.lastContact
          ? new Date(c.lastContact + 'T12:00:00').toLocaleDateString('pt-BR')
          : '',
        notes:       c.notes ?? '',
      });

      row.getCell('totalPaid').numFmt = BRL;
      row.getCell('caseCount').alignment = { horizontal: 'center' };

      const bgColor = STATUS_FILL_ARG[c.status] ?? (idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB');
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', wrapText: false };
      });
    });

    // Aba de resumo
    const wsSummary = workbook.addWorksheet('Resumo');
    wsSummary.columns = [
      { header: 'Status',    key: 'status',  width: 22 },
      { header: 'Quantidade', key: 'count',  width: 14 },
    ];
    const sumHeader = wsSummary.getRow(1);
    sumHeader.eachCell(cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: NAVY };
      cell.font   = { bold: true, color: WHITE, size: 10 };
      cell.alignment = { horizontal: 'center' };
    });

    const countByStatus: Record<string, number> = {};
    clients.forEach(c => { countByStatus[c.status] = (countByStatus[c.status] || 0) + 1; });
    Object.entries(countByStatus).forEach(([status, count]) => {
      wsSummary.addRow({ status: CLIENT_STATUS_MAP[status] ?? status, count });
    });
    wsSummary.addRow({ status: 'TOTAL', count: clients.length }).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url    = URL.createObjectURL(blob);
    const link   = document.createElement('a');
    link.href     = url;
    link.download = `clientes-${tenantName.replace(/\s+/g, '-').toLowerCase()}-${dateStr}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao exportar Excel de clientes:', error);
    alert('Erro ao gerar Excel de clientes. Tente novamente.');
  }
}
