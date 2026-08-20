create table email_templates (
  key text primary key,
  subject text not null,
  body_text text not null,
  body_html text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table email_templates enable row level security;
-- No public policy: service-role access only.

insert into email_templates (key, subject, body_text, body_html) values
(
  'recruiter_verification',
  'Confirm your email to use Merito''s recruiter scoring tool',
  E'Click to confirm your email and start scoring candidates:\n{{url}}\n\nThis link expires in 30 minutes.',
  '<p>Click to confirm your email and start scoring candidates:</p><p><a href="{{url}}">{{url}}</a></p><p>This link expires in 30 minutes.</p>'
),
(
  'recruiter_viewed',
  'A recruiter checked out your profile',
  E'Hi {{candidateName}},\n\nA recruiter checked out your Merito profile through our recruiter extension.\n\nSee your recruiter activity: {{dashboardUrl}}',
  '<p>Hi {{candidateName}},</p><p>A recruiter checked out your Merito profile through our recruiter extension.</p><p><a href="{{dashboardUrl}}">See your recruiter activity</a></p>'
),
(
  'payment_failed_alert',
  'Payment failed — order {{orderId}}',
  E'A payment failed.\n\nOrder: {{orderId}}\nAmount: ₹{{amountRupees}}\nCandidate: {{candidateEmail}}',
  '<p>A payment failed.</p><p>Order: {{orderId}}<br/>Amount: ₹{{amountRupees}}<br/>Candidate: {{candidateEmail}}</p>'
),
(
  'referee_invite',
  '{{candidateName}} listed you as a professional reference',
  E'Hi {{refereeName}},\n\n{{candidateName}} listed you as a reference on Merito. Please share quick feedback here:\n{{url}}\n\nThis link expires in {{validityDays}} days.',
  '<p>Hi {{refereeName}},</p><p>{{candidateName}} listed you as a reference on Merito. Please share quick feedback:</p><p><a href="{{url}}">{{url}}</a></p><p>This link expires in {{validityDays}} days.</p>'
),
(
  'referee_reminder',
  'Reminder: {{candidateName}} is waiting on your feedback',
  E'Hi {{refereeName}},\n\nJust a reminder — {{candidateName}} is waiting on your reference feedback:\n{{url}}',
  '<p>Hi {{refereeName}},</p><p>Just a reminder — {{candidateName}} is waiting on your reference feedback:</p><p><a href="{{url}}">{{url}}</a></p>'
),
(
  'contact_form_submission',
  'New contact form submission from {{fullName}}',
  E'Name: {{fullName}}\nEmail: {{email}}\nPhone: {{phone}}\nDepartments: {{departments}}\n\nMessage:\n{{message}}',
  '<h2>New contact form submission</h2><p><strong>Name:</strong> {{fullName}}</p><p><strong>Email:</strong> {{email}}</p><p><strong>Phone:</strong> {{phone}}</p><p><strong>Departments:</strong> {{departments}}</p><p><strong>Message:</strong></p><p>{{message}}</p>'
);
