// Sample documents for the Chunk Lab and the challenges.
// All companies, products and policies are fictional.
//
// Each question has a `gold` answer span: exact text from the document
// (whitespace may differ). Retrieval is judged by whether a retrieved chunk
// fully contains that span.

const F = '```';

const refund = `# NimbusDesk Refund & Returns Policy

Last updated: 04/03/2026 (v3.2). This policy covers hardware bought from the NimbusDesk store: the Nimbus Hub (NH-2), the DH-1 desk headset, USB-C cables and spare ear cushions.

## 1. Standard refunds

You can ask for a refund from the Orders page or by emailing the support team. Requests made within 30 days of delivery are approved automatically, as long as the item comes back in its original packaging. Refunds after 30 days are allowed only if the item is defective or arrived damaged, and the fault must be reported within 90 days of delivery. In that case we also pay for the return shipping.

## 2. How refunds are paid

Approved refunds go back to the original payment method within 5 to 7 business days. If you paid with a gift card, the amount is returned as store credit instead. We do not charge a restocking fee for standard returns. You will get an email at each step: when the parcel arrives at our warehouse, when it passes inspection, and when the money is on its way.

## 3. Items that cannot be refunded

Gift cards, opened ear cushions and anything marked Final Sale cannot be refunded. Personalised items, such as headsets with an engraved name, can only be returned if they are faulty. Bundles must be returned complete; if one part is missing, we refund the bundle price minus the list price of the missing part.

## 4. Exchanges

If you would rather have a different colour or model, choose Exchange instead of Refund on the Orders page. Exchanges are free within 45 days of delivery. We ship the replacement as soon as the original item is scanned by the courier, so you are not left without a device for long. An exchange can only be made once per order.

## 5. Software subscriptions

Monthly subscriptions can be cancelled at any time and stay active until the end of the current billing month. We do not give partial refunds for unused days on monthly plans. Annual plans can be cancelled within 14 days of purchase for a full refund; after that, the plan stays active until the end of the billing year. If we raise prices, existing annual customers keep their current price until renewal.

## 6. Damaged or missing deliveries

Check your parcel when it arrives. If the box is crushed or wet, take a photo before opening it. Report missing or damaged deliveries within 7 days, and include the order number and the photos. For missing parcels we first open an investigation with the courier, which usually takes 3 business days, and then send a replacement or a refund.

## 7. Business customers

Organisations that buy more than 20 devices through a sales contract follow the return terms in that contract. If the contract does not mention returns, this policy applies. Purchase orders cannot be part-refunded; contact your account manager to arrange a credit note instead.

## 8. Contact

Questions about this policy can be sent to the support team through the Help Centre. Please include your order number so we can find your purchase quickly. We aim to reply within one business day.
`;

const faq = `# NimbusDesk Help Centre FAQ

Answers to the questions our support team hears most often. If you can't find what you need, use the chat button in the bottom corner of the app.

## Account and sign-in

### How do I reset my password?
Click "Forgot password" on the sign-in screen and enter your work email. We send a reset link that works for 30 minutes. If the email doesn't arrive, check your spam folder or ask your workspace admin to send a new invite.

### Can I use single sign-on?
Yes. Single sign-on with SAML or Google Workspace is available on the Business plan as part of the SSO and audit log add-on. Once it is switched on, admins can require every agent to sign in through the identity provider.

### How do I turn on two-factor authentication?
Open Profile, then Security, and choose "Set up two-factor". Scan the QR code with any authenticator app and type in the six-digit code to confirm. Admins can make two-factor sign-in mandatory for the whole workspace.

## Tickets and inbox

### What is the difference between a ticket and a conversation?
A conversation is a single thread with a customer, such as one email chain or one chat. A ticket is the unit of work your team tracks: it has an owner, a status and a priority. Several conversations can be merged into one ticket when a customer writes in about the same problem twice.

### How do I merge duplicate tickets?
Select the tickets in the inbox list, open the More menu and choose Merge. Pick the ticket that should stay open; the others are closed and their messages move into it. Merging cannot be undone, so check the customer name before you confirm.

### Can customers see internal notes?
No. Internal notes are shown with a yellow background and are only visible to agents in your workspace. Customers only ever see public replies. Be careful when forwarding a ticket by email, because the forward includes the notes.

### How do I export my ticket history?
Go to Settings, then Data, then Export, choose a date range and click Export CSV. Exports with more than 50,000 tickets are emailed to you as a zipped file instead of downloading straight away. Only admins can run exports.

## Automation

### What can automation rules do?
Rules run when a ticket is created or updated. They can assign the ticket to a team, set its priority, add tags, or send an auto-reply. Rules run from top to bottom, and you can drag them to change the order.

### Why didn't my rule fire?
The most common reasons are that the rule is paused, that an earlier rule changed the ticket so the conditions no longer match, or that the rule only runs on new tickets. Open the ticket's Activity tab to see which rules ran and why.

### Is there a limit on the number of rules?
The Team plan allows 25 active rules. The Business plan has no limit. Paused rules do not count towards the limit.

## Integrations

### Which apps does NimbusDesk connect to?
There are ready-made integrations for popular chat, e-commerce and CRM tools, plus a public REST API and webhooks for everything else. You can find the full list in the Integrations directory inside the app.

### How do webhooks work?
A webhook sends an HTTP POST request to a URL you choose whenever an event happens, such as a new ticket or a status change. Each request is signed so you can check it came from NimbusDesk. If your server is down, we retry up to 5 times over 24 hours.

## Billing

### When am I charged?
Monthly plans are charged on the same day each month as your first payment. Annual plans are charged once a year. You get an invoice by email straight after each payment.

### Can I change plans in the middle of a billing cycle?
Yes. Upgrades take effect immediately and you pay the difference for the rest of the cycle. Downgrades take effect at the start of the next cycle.

### Do you offer discounts for non-profits?
Registered non-profits and schools get 30 percent off any paid plan. Send proof of registration to the billing team to apply.

## Data and privacy

### Where is my data stored?
Workspaces are hosted in data centres in Mumbai and Frankfurt. You choose the region when you create the workspace, and it cannot be changed later.

### How long do you keep deleted tickets?
Deleted tickets stay in the Trash for 30 days and can be restored by an admin. After that they are permanently removed from our systems within 14 days.
`;

const pricing = `# NimbusDesk Pricing

NimbusDesk is a help-desk tool for support teams. Every plan includes the shared inbox, email and web-form channels, and the mobile app. Prices are in Indian rupees, exclude GST, and are billed monthly unless you choose annual billing.

## Plans

### Starter plan
Starter is designed for solo founders who answer a few customer emails a day.
It is free for one agent and keeps 30 days of ticket history.

### Team plan

Team is built for growing support groups that share one inbox. It adds saved replies, simple automation rules and a shared knowledge base.

It costs ₹499 per month and includes 5 seats.

Extra seats can be added at any time from the Billing page, and seats you remove are credited back to your account at the next renewal date.

### Business plan
Business adds round-the-clock chat and phone support, custom roles and a 99.9% uptime guarantee.
Pricing starts at ₹4,999 per month for 20 seats, and annual billing saves two months.

## Add-ons

Add-ons can be switched on or off at any time from the Billing page and are charged per workspace, not per agent.

| Add-on | Price per month | Available on | What you get |
|---|---|---|---|
| AI reply drafts | ₹1,200 | Team, Business | Suggested replies written from your help articles |
| Extra storage | ₹300 | All plans | 100 GB more space for attachments |
| Phone channel | ₹2,500 | Business | Inbound calls routed to agents, with recordings |
| SSO and audit log | ₹1,800 | Business | Single sign-on and a full audit trail |
| Sandbox workspace | ₹900 | Business | A test copy of your workspace for trying changes |

Add-ons are billed together with your plan and appear as separate lines on the invoice.

## Billing and payment

You can pay by card, UPI or bank transfer. Annual billing is paid upfront and gives you two months free compared with paying monthly. If a card payment fails, we try again after 3 days and after 7 days, and the workspace switches to read-only after 14 days without payment.

## Discounts

Registered non-profits and schools get 30 percent off any paid plan. Start-ups in a recognised incubator can apply for 6 months of the Team plan at no cost. Discounts cannot be combined.

## Changing or cancelling

Upgrades take effect straight away and are charged pro rata. Downgrades and cancellations take effect at the end of the current billing period, and your data stays available for export for 30 days after cancelling.
`;

const readme = `# nimbus-cli

A command-line tool for working with the (fictional) NimbusDesk API: list tickets, send replies and manage webhooks from your terminal.

## Installation

You need Node.js 20 or newer. Install the CLI globally with npm:

${F}bash
npm install --global @nimbusdesk-demo/cli
nimbus --version
${F}

## Authentication

Create an API token in the NimbusDesk app under Settings, then Developer, then API tokens. The CLI reads the token from the NIMBUS_API_TOKEN environment variable, so it never has to be written into a file in your project.

${F}bash
export NIMBUS_API_TOKEN="paste-your-token-here"
nimbus whoami
${F}

Tokens inherit the permissions of the user who created them. Use a dedicated service account for scripts that run in CI.

## Quick start

List the ten newest open tickets and reply to one of them:

${F}bash
nimbus tickets list --status open --limit 10
nimbus tickets reply 4821 --message "Thanks, we're looking into it."
${F}

## Configuration

Settings can be stored in a file called .nimbusrc.json in your home directory. Values passed on the command line always win over the file.

${F}json
{
  "workspace": "acme-support",
  "region": "in",
  "output": "table",
  "timeoutSeconds": 30
}
${F}

The region must match the region your workspace was created in: use "in" for Mumbai or "eu" for Frankfurt.

## Rate limits

The API allows 120 requests per minute per token. When you go over the limit, the API returns HTTP 429 and the CLI waits for the number of seconds given in the Retry-After header before trying again. Bulk commands such as tickets export already pause between pages.

## Webhooks

Use the webhooks commands to receive events in your own service:

${F}bash
nimbus webhooks create --url https://example.com/hooks/nimbus --events ticket.created,ticket.updated
nimbus webhooks list
${F}

Every webhook request includes an X-Nimbus-Signature header. To verify it, compute an HMAC-SHA256 of the raw request body using your webhook secret and compare it with the header value using a constant-time comparison.

${F}python
import hmac, hashlib

def is_valid(body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
${F}

## Troubleshooting

If a command fails with "workspace not found", check that the region in .nimbusrc.json matches your workspace. Run any command with --debug to print the full HTTP request and response. Timeouts can be raised with the timeoutSeconds setting.

## Contributing

Bug reports and pull requests are welcome. Please run the test suite with npm test before opening a pull request, and add a test for any behaviour you change.
`;

// A messy plain-text extract, the kind of thing a PDF parser produces:
// repeated headers/footers, words hyphenated across lines, hard line wraps
// and stray spaces.
const messy = `ACME Corp — Confidential — Page 3
Employee  Leave  Policy  (HR-POL-007)

1. Annual leave
All full-time employees receive 24 days of paid annual   leave per calendar
year. Leave is earned monthly, so a new joiner accrues two days for
each full month worked. Up to 10 unused days may be carried for-
ward into the next year; anything above that lapses on 31 March.

2. Sick leave
Employees may take up to 12 days of paid sick leave per year. For
absences longer than two consecutive working days, a medical certifi-
cate must be submitted to your manager within one week of returning.

HR-POL-007 · Version 2.1 · Internal use only
ACME Corp — Confidential — Page 4

3. Parental leave
Primary caregivers are entitled to 26 weeks of paid par-
ental leave. Secondary caregivers receive 4 weeks of paid leave,
which can be taken in one block or split into two blocks within
the first year after the birth or adoption.

4. Bereavement leave
Up to 5 days of paid leave are granted on the death of an immedi-
ate family member, and 2 days for other relatives. Additional unpaid
leave can be agreed with your manager.

HR-POL-007 · Version 2.1 · Internal use only
ACME Corp — Confidential — Page 5

5. Requesting leave
Submit requests through the HR portal at least 14 days in ad-
vance for planned leave of more than three days. Managers should
respond within 3 working days. Unplanned absences must be re-
ported to your manager before 10 a.m. on the first day.

6. Leave encashment
On leaving the company, unused annual leave is paid out at the em-
ployee's basic daily rate. Sick leave and parental leave are not
encashable.

HR-POL-007 · Version 2.1 · Internal use only
`;

export const DOCUMENTS = [
  {
    id: 'refund',
    title: 'NimbusDesk Refund & Returns Policy',
    kind: 'Policy (prose with an exception clause)',
    text: refund,
    questions: [
      { q: 'Can I get a refund after 30 days?', gold: 'Refunds after 30 days are allowed only if the item is defective or arrived damaged, and the fault must be reported within 90 days of delivery.' },
      { q: 'How long does it take for a refund to reach my account?', gold: 'Approved refunds go back to the original payment method within 5 to 7 business days.' },
      { q: 'Which items cannot be refunded?', gold: 'Gift cards, opened ear cushions and anything marked Final Sale cannot be refunded.' },
      { q: 'Can I cancel an annual subscription and get my money back?', gold: 'Annual plans can be cancelled within 14 days of purchase for a full refund' },
      { q: 'How long do I have to report a damaged delivery?', gold: 'Report missing or damaged deliveries within 7 days' },
    ],
  },
  {
    id: 'faq',
    title: 'NimbusDesk Help Centre FAQ',
    kind: 'FAQ (question and answer pairs)',
    text: faq,
    questions: [
      { q: 'How do I export my ticket history to CSV?', gold: 'Go to Settings, then Data, then Export, choose a date range and click Export CSV.' },
      { q: 'How long is the password reset link valid?', gold: 'We send a reset link that works for 30 minutes.' },
      { q: 'Can customers see internal notes?', gold: 'Internal notes are shown with a yellow background and are only visible to agents in your workspace.' },
      { q: 'How many automation rules can I have on the Team plan?', gold: 'The Team plan allows 25 active rules.' },
      { q: 'How many times are failed webhooks retried?', gold: 'If your server is down, we retry up to 5 times over 24 hours.' },
      { q: 'Where is my data stored?', gold: 'Workspaces are hosted in data centres in Mumbai and Frankfurt.' },
    ],
  },
  {
    id: 'pricing',
    title: 'NimbusDesk Pricing',
    kind: 'Pricing page with a Markdown table',
    text: pricing,
    questions: [
      { q: 'How much is the Team plan?', gold: 'It costs ₹499 per month and includes 5 seats.' },
      { q: 'How much does the Phone channel add-on cost per month?', gold: '| Add-on | Price per month | Available on | What you get |\n|---|---|---|---|\n| AI reply drafts | ₹1,200 | Team, Business | Suggested replies written from your help articles |\n| Extra storage | ₹300 | All plans | 100 GB more space for attachments |\n| Phone channel | ₹2,500 | Business | Inbound calls routed to agents, with recordings |' },
      { q: 'What happens if my card payment fails?', gold: 'If a card payment fails, we try again after 3 days and after 7 days, and the workspace switches to read-only after 14 days without payment.' },
      { q: 'Do non-profits get a discount?', gold: 'Registered non-profits and schools get 30 percent off any paid plan.' },
    ],
  },
  {
    id: 'readme',
    title: 'nimbus-cli README',
    kind: 'Developer README (headings and code blocks)',
    text: readme,
    questions: [
      { q: 'How do I install the CLI?', gold: 'npm install --global @nimbusdesk-demo/cli' },
      { q: 'Which environment variable holds the API token?', gold: 'The CLI reads the token from the NIMBUS_API_TOKEN environment variable' },
      { q: 'What is the API rate limit?', gold: 'The API allows 120 requests per minute per token.' },
      { q: 'How do I verify a webhook signature?', gold: 'compute an HMAC-SHA256 of the raw request body using your webhook secret' },
      { q: 'Where is the config file stored?', gold: 'Settings can be stored in a file called .nimbusrc.json in your home directory.' },
    ],
  },
  {
    id: 'messy',
    title: 'ACME Employee Leave Policy (raw PDF extract)',
    kind: 'Messy PDF extract (headers, footers, hyphenation)',
    text: messy,
    questions: [
      { q: 'How many weeks of parental leave do primary caregivers get?', gold: 'Primary caregivers are entitled to 26 weeks of paid parental leave.' },
      { q: 'How many unused leave days can be carried forward?', gold: 'Up to 10 unused days may be carried forward into the next year' },
      { q: 'When do I need a medical certificate for sick leave?', gold: 'For absences longer than two consecutive working days, a medical certificate must be submitted to your manager within one week of returning.' },
      { q: 'How far in advance should I request planned leave?', gold: 'Submit requests through the HR portal at least 14 days in advance for planned leave of more than three days.' },
      { q: 'Is unused annual leave paid out when I leave?', gold: "On leaving the company, unused annual leave is paid out at the employee's basic daily rate." },
    ],
  },
];

export function getDocument(id) {
  return DOCUMENTS.find((d) => d.id === id);
}
