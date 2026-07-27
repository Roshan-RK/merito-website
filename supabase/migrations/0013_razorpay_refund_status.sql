alter table razorpay_transactions drop constraint razorpay_transactions_status_check;
alter table razorpay_transactions add constraint razorpay_transactions_status_check
  check (status in ('initiated', 'success', 'failed', 'refunded'));
