import * as XLSX from 'xlsx';

export const downloadWorkOrderTemplate = () => {
  const headers = [
    '_status', '_title', '_server_updated_at', '_updated_by', '_geometry', '_latitude', '_longitude',
    'general_foreman', 'foreman', 'work_order_number', 'address', 'customer_need_date',
    'date_locates_called_in', 'locate_ticket_number', 'expiration_date', 'locate_renewal_date',
    'renewal_expiration_date', 'switching_required_requested', 'so_', 'outage_required',
    'outage_notes', 'permitting_needed', 'locked_gates', 'traffic_control_needed',
    'traffic_control_notes', 'hydrovac_needed', 'hydrovac_notes', 'tree_trimming_needed',
    'notes', 'date_work_completed', 'post_construction_asbuilt', 'post_construction_notes'
  ];
  const sampleRow: Record<string, any> = {};
  headers.forEach(h => { sampleRow[h] = ''; });
  sampleRow._status = 'Field Check';
  sampleRow.work_order_number = '123456789';
  sampleRow.general_foreman = 'Marlon Davis';
  sampleRow.foreman = 'Derek Mills';
  sampleRow.address = '7280 KATY FREEWAY, HOUSTON, TX 77080-3824';
  sampleRow._latitude = 30.0106;
  sampleRow._longitude = -95.4003;
  sampleRow.switching_required_requested = 'no';
  sampleRow.outage_required = 'no';
  sampleRow.permitting_needed = 'yes';
  sampleRow.locked_gates = 'yes';
  sampleRow.traffic_control_needed = 'no';
  sampleRow.hydrovac_needed = 'no';
  sampleRow.tree_trimming_needed = 'no';

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
  XLSX.utils.book_append_sheet(wb, ws, 'Work Orders');
  XLSX.writeFile(wb, 'work_order_template.xlsx');
};

export const downloadInvoiceTemplate = () => {
  const headers = ['Invoice #', 'Created Date', 'Status', 'PO #', 'Total', 'Unanswered Comments', 'Dispute Reason'];
  const sampleRow: Record<string, any> = {};
  headers.forEach(h => { sampleRow[h] = ''; });
  sampleRow['Invoice #'] = '9999';
  sampleRow['Created Date'] = '2026-08-20';
  sampleRow.Status = 'Unapproved';
  sampleRow['PO #'] = 'WO_121213513_99999';
  sampleRow.Total = 4500.00;
  sampleRow['Unanswered Comments'] = 'false';

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
  XLSX.writeFile(wb, 'invoice_template.xlsx');
};
