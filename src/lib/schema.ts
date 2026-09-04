/**
 * Migration registry + schema-intelligence helpers.
 *
 * Each migration entry describes a logical schema change. The
 * `expectedSchema` snapshots the tables / columns / RPCs the
 * application depends on, allowing the Bug Catcher and CEO system
 * health views to detect drift without blindly executing SQL.
 */
export interface SchemaExpectation {
  table: string
  columns: string[]
  pks?: string[]
  fks?: { column: string; refTable: string; refColumn: string }[]
}

export interface RpcExpectation {
  name: string
  args?: string[]
  returns?: string
}

export const EXPECTED_TABLES: SchemaExpectation[] = [
  { table: 'users', columns: ['id', 'email', 'full_name', 'role', 'employment_status', 'account_status', 'access_version', 'employee_id'] },
  { table: 'employees', columns: ['id', 'user_id', 'employee_number', 'first_name', 'last_name', 'preferred_name', 'email', 'phone', 'department_id', 'position_id', 'manager_id', 'employment_type', 'start_date', 'employment_status', 'account_status', 'created_at'] },
  { table: 'departments', columns: ['id', 'name', 'description', 'enabled'] },
  { table: 'positions', columns: ['id', 'title', 'department_id', 'description', 'employment_type', 'enabled'] },
  { table: 'employment_records', columns: ['id', 'employee_id', 'position_id', 'department_id', 'manager_id', 'effective_from', 'effective_to', 'change_type', 'reason', 'changed_by'] },
  { table: 'employee_status_history', columns: ['id', 'employee_id', 'status', 'effective_from', 'effective_to', 'changed_by', 'reason'] },
  { table: 'time_entries', columns: ['id', 'employee_id', 'clock_in_at', 'clock_out_at', 'break_minutes', 'status', 'source'] },
  { table: 'break_entries', columns: ['id', 'time_entry_id', 'started_at', 'ended_at', 'kind'] },
  { table: 'time_entry_corrections', columns: ['id', 'time_entry_id', 'requested_by', 'approved_by', 'correction', 'reason', 'status'] },
  { table: 'timesheets', columns: ['id', 'employee_id', 'period_start', 'period_end', 'status', 'submitted_at', 'approved_by', 'approved_at'] },
  { table: 'timesheet_entries', columns: ['id', 'timesheet_id', 'time_entry_id', 'regular_minutes', 'overtime_minutes', 'pto_minutes'] },
  { table: 'schedules', columns: ['id', 'employee_id', 'department_id', 'starts_at', 'ends_at', 'break_minutes', 'notes'] },
  { table: 'pto_policies', columns: ['id', 'name', 'annual_hours', 'accrual'] },
  { table: 'pto_balances', columns: ['id', 'employee_id', 'policy_id', 'balance_hours'] },
  { table: 'pto_requests', columns: ['id', 'employee_id', 'policy_id', 'starts_at', 'ends_at', 'hours', 'reason', 'status', 'decided_by', 'decided_at'] },
  { table: 'pay_rates', columns: ['id', 'employee_id', 'pay_type', 'rate', 'effective_from', 'effective_to'] },
  { table: 'payroll_periods', columns: ['id', 'starts_at', 'ends_at', 'status'] },
  { table: 'payroll_records', columns: ['id', 'period_id', 'employee_id', 'gross', 'net', 'regular_minutes', 'overtime_minutes', 'other_earnings', 'deductions_total', 'status'] },
  { table: 'payroll_items', columns: ['id', 'record_id', 'kind', 'description', 'amount'] },
  { table: 'payroll_deductions', columns: ['id', 'record_id', 'kind', 'description', 'amount'] },
  { table: 'pay_stubs', columns: ['id', 'record_id', 'employee_id', 'snapshot'] },
  { table: 'employee_documents', columns: ['id', 'employee_id', 'title', 'storage_path', 'kind'] },
  { table: 'hr_requests', columns: ['id', 'employee_id', 'kind', 'subject', 'body', 'status'] },
  { table: 'hr_notes', columns: ['id', 'employee_id', 'author_id', 'body'] },
  { table: 'notifications', columns: ['id', 'user_id', 'kind', 'title', 'body', 'read_at', 'order_id', 'metadata'] },
  { table: 'order_messages', columns: ['id', 'order_id', 'sender_user_id', 'sender_role', 'message', 'created_at', 'read_at'] },
  { table: 'project_progress', columns: ['order_id', 'current_stage', 'progress_percent', 'customer_visible', 'customer_message', 'estimated_completion', 'store_account_owner'] },
  { table: 'project_progress_history', columns: ['id', 'order_id', 'previous_stage', 'new_stage', 'previous_percent', 'new_percent', 'changed_by', 'created_at'] },
  { table: 'project_internal_notes', columns: ['id', 'order_id', 'body', 'author_id', 'created_at'] },
  { table: 'project_store_management', columns: ['order_id', 'apple_account_owner', 'google_account_owner', 'apple_status', 'google_status', 'apple_app_id', 'google_package_name', 'management_enabled', 'monthly_fee_cents', 'updated_at', 'updated_by'] },
  { table: 'audit_logs', columns: ['id', 'actor_id', 'action', 'target', 'result', 'reason', 'metadata'] },
  { table: 'bug_reports', columns: ['id', 'severity', 'status', 'title', 'error_type', 'fingerprint', 'occurrence_count', 'route'] },
  { table: 'universal_blocker_events', columns: ['id', 'action', 'actor_id', 'reason', 'created_at'] },
  { table: 'schema_migrations', columns: ['id', 'name', 'checksum', 'status', 'applied_at'] },
  { table: 'platforms', columns: ['id', 'slug', 'name', 'description', 'enabled', 'monitoring_enabled', 'analytics_enabled', 'analytics_config', 'maiupdate_url', 'last_sync_at', 'last_check_at', 'last_status', 'created_at', 'updated_at'] },
  { table: 'platform_apps', columns: ['id', 'platform_id', 'name', 'version', 'build_number', 'download_url', 'file_size', 'icon_url', 'description', 'app_status', 'release_time', 'is_latest', 'created_by', 'created_at', 'updated_at'] },
  { table: 'app_updates', columns: ['id', 'platform_id', 'app_id', 'version', 'title', 'description', 'release_notes', 'release_time', 'download_url', 'file_size', 'icon_url', 'is_featured', 'update_type', 'status', 'published_at', 'created_by', 'synced_from_maiupdate', 'created_at', 'updated_at'] },
  { table: 'companies', columns: ['id', 'slug', 'name', 'tagline', 'description', 'logo_url', 'hero_url', 'website', 'play_url', 'store_url', 'status', 'featured', 'sort_order', 'category', 'launch_date'] },
  { table: 'products', columns: ['id', 'slug', 'name', 'category', 'description', 'price_cents', 'features', 'image_url', 'status', 'featured', 'sort_order', 'estimated_delivery', 'management_available'] },
  { table: 'orders', columns: ['id', 'customer_id', 'product_id', 'amount_cents', 'currency', 'status', 'paypal_order_id', 'paypal_capture_id', 'infrastructure_acknowledged_at', 'infrastructure_payment_responsibility', 'infrastructure_initial_cost_cents'] },
  { table: 'project_intakes', columns: ['id', 'order_id', 'payload', 'submitted_at'] },
  { table: 'intake_notifications', columns: ['id', 'order_id', 'customer_id', 'kind', 'to_email', 'subject', 'resend_message_id', 'error', 'sent_at'] },
  { table: 'order_timeline', columns: ['id', 'order_id', 'status', 'note', 'changed_by'] },
  { table: 'customer_infrastructure', columns: ['id', 'order_id', 'domain', 'hosting', 'database_info', 'email', 'storage', 'other'] },
  { table: 'infrastructure_accounts', columns: ['id', 'order_id', 'customer_id', 'provider', 'provider_resource_id', 'plan_tier', 'monthly_cost_cents', 'status', 'activated_at', 'suspended_at', 'suspension_reason', 'restored_at', 'restored_by', 'last_synced_at', 'metadata'] },
  { table: 'infrastructure_coverage', columns: ['id', 'order_id', 'customer_id', 'infrastructure_id', 'coverage_type', 'monthly_fee_cents', 'infrastructure_cost_cents', 'billing_start_date', 'current_period_start', 'current_period_end', 'next_invoice_date', 'status', 'auto_renew', 'cancelled_at', 'cancellation_reason', 'cancelled_by', 'suspended_at', 'suspension_reason', 'restored_at', 'restored_by'] },
  { table: 'infrastructure_invoices', columns: ['id', 'invoice_number', 'order_id', 'customer_id', 'infrastructure_id', 'coverage_id', 'coverage_type', 'management_plan', 'billing_period_start', 'billing_period_end', 'issue_date', 'due_date', 'infrastructure_cost_cents', 'coverage_fee_cents', 'additional_costs_cents', 'total_cents', 'currency', 'status', 'paypal_order_id', 'paypal_capture_id', 'paypal_approval_url', 'paypal_error', 'paid_at', 'payment_method', 'payment_reference', 'paid_by', 'email_sent_at', 'email_message_id', 'email_error', 'overdue_email_sent_at', 'suspended_email_sent_at', 'restored_email_sent_at', 'pdf_storage_path', 'pdf_generated_at'] },
  { table: 'infrastructure_notifications', columns: ['id', 'customer_id', 'invoice_id', 'coverage_id', 'order_id', 'kind', 'title', 'body'] },
  { table: 'page_content', columns: ['id', 'key', 'value'] },
  { table: 'announcements', columns: ['id', 'title', 'body', 'image_url', 'company_id', 'status', 'publish_at', 'expire_at', 'featured'] },
  { table: 'contact_submissions', columns: ['id', 'name', 'email', 'subject', 'body', 'category'] },
  { table: 'support_donations', columns: ['id', 'name', 'email', 'amount_cents', 'currency', 'message', 'paypal_order_id', 'status'] },
  { table: 'secrets', columns: ['id', 'platform_id', 'kind', 'label', 'configured'] },
  { table: 'diagnostic_runs', columns: ['id', 'platform_id', 'started_at', 'finished_at', 'result'] },
  { table: 'diagnostic_results', columns: ['id', 'run_id', 'check', 'target', 'status', 'severity', 'message', 'remediation'] },
]

export const EXPECTED_RPCS: RpcExpectation[] = [
  { name: 'hire_employee' },
  { name: 'terminate_employee' },
  { name: 'suspend_employee' },
  { name: 'reactivate_employee' },
  { name: 'promote_employee' },
  { name: 'transfer_employee' },
  { name: 'place_on_leave' },
  { name: 'return_from_leave' },
  { name: 'clock_in' },
  { name: 'clock_out' },
  { name: 'start_break' },
  { name: 'end_break' },
  { name: 'approve_timesheet' },
  { name: 'reject_timesheet' },
  { name: 'calculate_payroll' },
  { name: 'approve_payroll' },
  { name: 'close_payroll' },
  { name: 'create_paypal_order' },
  { name: 'capture_paypal_order' },
  { name: 'paypal_webhook' },
  { name: 'run_diagnostics' },
  { name: 'app_updates_count' },
  { name: 'upsert_app_update' },
  { name: 'mark_order_messages_read' },
  { name: 'get_ceo_project_summaries' },
  { name: 'initialize_infrastructure_coverage' },
  { name: 'generate_next_invoice' },
  { name: 'process_overdue_invoices' },
  { name: 'mark_overdue_state' },
  { name: 'execute_suspension' },
  { name: 'mark_invoice_paid' },
  { name: 'confirm_restoration' },
  { name: 'cancel_coverage' },
  { name: 'run_monthly_renewals' },
  { name: 'record_infrastructure_notification' },
  { name: 'next_infrastructure_invoice_number' },
  { name: 'mai_coverage_monthly_fee_cents' },
  { name: 'mark_intake_submitted' },
]

export const CURRENT_SCHEMA_VERSION = '2026.09.04.002'