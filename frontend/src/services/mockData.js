import { CURRENCY, PERMISSIONS, STATUS } from '../utils/constants';

export const department = { id: 2, name: 'Engineering & Product', name_ar: 'الهندسة وتطوير البرمجيات' };
export const demoUsers = [
  { id: 5, username: 'sara', email: 'sara@company.sa', full_name: 'سارة العتيبي', department_id: 2, department, role: 'employee', is_superuser: false, permissions: [PERMISSIONS.OWN] },
  { id: 8, username: 'khalid', email: 'khalid@company.sa', full_name: 'خالد المنصور', department_id: 2, department, role: 'manager', is_superuser: false, permissions: [PERMISSIONS.OWN, PERMISSIONS.DEPARTMENT] },
  { id: 11, username: 'omar', email: 'omar@company.sa', full_name: 'Omar Alharbi', department_id: 2, department, role: 'employee', is_superuser: false, permissions: [PERMISSIONS.OWN] },
  { id: 12, username: 'noura', email: 'noura@company.sa', full_name: 'نورة القحطاني', department_id: 2, department, role: 'employee', is_superuser: false, permissions: [PERMISSIONS.OWN] },
  { id: 20, username: 'finance', email: 'finance@company.sa', full_name: 'Lina Hassan', department_id: 4, department: { id: 4, name: 'Finance' }, role: 'finance_admin', is_superuser: false, permissions: [PERMISSIONS.FINANCE] },
];
export const DEMO_PASSWORD = 'Masroof123!';
export const demoCategories = [
  { id: 1, name: 'Meals & hospitality', name_ar: 'وجبات وضيافة' },
  { id: 2, name: 'Office supplies', name_ar: 'مستلزمات مكتبية' },
  { id: 3, name: 'Travel & transport', name_ar: 'سفر وتنقلات' },
  { id: 4, name: 'Software & subscriptions', name_ar: 'برامج واشتراكات' },
  { id: 5, name: 'Training & events', name_ar: 'تدريب وفعاليات' },
];
const history = (id, decision, note, day = 16) => ({ id, actor_name: 'خالد المنصور', decision, note, created_at: `2026-11-${day}T10:30:00Z` });
const seeds = [
  [101, 5, 3, '1450.00', 'تذكرة طيران لحضور اجتماع العميل في جدة', '2026-11-15', STATUS.PENDING_MANAGER, { anomaly_score: 0.74, risk_level: 'High', warnings: ['المبلغ أعلى من متوسط فئة السفر لهذا القسم', 'Confirm that the fare includes only business travel.'] }, [history(1, STATUS.NEEDS_CHANGES, 'يرجى إرفاق الفاتورة الضريبية بشكل أوضح', 15)]],
  [102, 11, 4, '349.00', 'Figma Professional — monthly design team subscription', '2026-11-16', STATUS.PENDING_MANAGER, null, []],
  [103, 12, 1, '685.50', 'ضيافة اجتماع انطلاق مشروع العميل', '2026-11-16', STATUS.PENDING_MANAGER, { anomaly_score: 0.32, risk_level: 'Medium', warnings: ['Please confirm the number of attendees in the receipt.'] }, []],
  [104, 5, 2, '420.00', 'شاشة وملحقات مكتبية لفريق التطوير', '2026-11-12', STATUS.NEEDS_CHANGES, null, [history(2, STATUS.NEEDS_CHANGES, 'يرجى توضيح تفاصيل المشتريات وإرفاق فاتورة ضريبية.', 13)]],
  [105, 5, 4, '199.00', 'GitHub Copilot — monthly subscription', '2026-11-10', STATUS.APPROVED, null, [history(3, STATUS.PENDING_FINANCE, 'Approved for the engineering team.', 11), { id: 4, actor_name: 'Lina Hassan', decision: STATUS.APPROVED, note: 'Receipt verified. Included in the next reimbursement run.', created_at: '2026-11-12T09:00:00Z' }]],
  [106, 5, 1, '280.00', 'غداء عمل مع فريق مشروع الرياض', '2026-11-09', STATUS.PENDING_FINANCE, null, [history(5, STATUS.PENDING_FINANCE, 'تمت الموافقة على مصروف اجتماع الفريق.', 10)]],
  [107, 5, 5, '1800.00', 'React Summit — online workshop registration', '2026-11-07', STATUS.APPROVED, null, [history(6, STATUS.PENDING_FINANCE, 'Training aligned with the team development plan.', 8), { id: 7, actor_name: 'Lina Hassan', decision: STATUS.APPROVED, note: 'Payment verified.', created_at: '2026-11-09T12:00:00Z' }]],
  [108, 5, 3, '95.00', 'تنقل من المكتب إلى مقر العميل', '2026-11-05', STATUS.REJECTED, null, [history(8, STATUS.REJECTED, 'هذا الإيصال مكرر في طلب سابق.', 6)]],
  [109, 11, 3, '2130.00', 'Dammam client visit — hotel and ground transport', '2026-11-14', STATUS.PENDING_MANAGER, { anomaly_score: 0.81, risk_level: 'High', warnings: ['Accommodation charge is above the typical nightly rate. Verify the stay dates.'] }, []],
  [110, 12, 5, '950.00', 'ورشة عمل تجربة المستخدم', '2026-11-08', STATUS.APPROVED, null, [history(9, STATUS.PENDING_FINANCE, '', 9), { id: 10, actor_name: 'Lina Hassan', decision: STATUS.APPROVED, note: '', created_at: '2026-11-10T09:00:00Z' }]],
  [111, 5, 1, '165.00', 'Coffee and refreshments for the sprint review', '2026-11-03', STATUS.APPROVED, null, [history(11, STATUS.PENDING_FINANCE, 'Team event confirmed.', 4), { id: 12, actor_name: 'Lina Hassan', decision: STATUS.APPROVED, note: '', created_at: '2026-11-05T10:00:00Z' }]],
  [112, 8, 3, '320.00', 'تنقلات زيارة عميل — الرياض', '2026-11-15', STATUS.PENDING_MANAGER, null, []],
  [113, 5, 2, '135.75', 'USB-C adapters for the meeting room', '2026-11-02', STATUS.APPROVED, null, [history(13, STATUS.PENDING_FINANCE, '', 3), { id: 14, actor_name: 'Lina Hassan', decision: STATUS.APPROVED, note: 'Verified.', created_at: '2026-11-04T10:00:00Z' }]],
  [114, 5, 3, '78.00', 'رحلة عمل إلى مكتب العميل', '2026-11-01', STATUS.PENDING_FINANCE, null, [history(15, STATUS.PENDING_FINANCE, 'تمت مراجعة الإيصال.', 2)]],
];
export function createDemoData() {
  return seeds.map(([id, requesterId, categoryId, amount, description, expense_date, status, ai_analysis, approvals]) => ({
    id, requester: structuredClone(demoUsers.find((user) => user.id === requesterId)), department: { ...department },
    category: { ...demoCategories.find((category) => category.id === categoryId) }, amount, currency: CURRENCY, description, expense_date, status,
    attachment_url: 'demo-receipt', attachment_name: `receipt-${id}.svg`, attachment_type: 'image/svg+xml', ai_analysis,
    approvals: structuredClone(approvals), created_at: `${expense_date}T08:20:00Z`,
  }));
}
