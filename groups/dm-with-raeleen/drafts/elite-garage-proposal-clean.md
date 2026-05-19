# Workflow Automation Proposal

## Service Reminder System: Elite Garage Repairs

**Prepared by:** Mettro Digital
**Date:** 18 May 2026
**Prepared for:** Elite Garage Repairs

---

## The Problem

Each week your team manually works through a multi-step process to identify customers due for a service reminder:

1. Search Xero for motors installed approximately two years ago
2. Cross-reference each result against Google Calendar and Gmail to confirm no recent service visit has taken place
3. Check whether the property is managed by a real estate agent. If so, the reminder goes to the agent rather than the owner
4. Send the appropriate reminder email from one of six templates, selected based on the motor type stored in Xero

This process is time-consuming, prone to things slipping through, and entirely dependent on someone doing it manually every week. The goal of this project is to automate the workflow end-to-end so that the right reminder goes to the right person at the right time, without manual intervention.

---

## Our Solution

We will build the automation in **Make.com**, a workflow automation platform that connects directly to Xero, Google Calendar, and Gmail without requiring any changes to how you currently run your jobs or raise invoices.

The automation runs on a weekly schedule and handles everything: identifying which customers are due for a reminder, checking whether a service visit has already occurred, routing the email to the agent or the property owner, and selecting the correct template for the motor type. You retain a review step before emails are sent (a list of that week's reminders for your approval), with the option to switch to fully automated sending once you're confident the system is working correctly.

---

## How It Works

**Step 1: Identify due customers**
Make.com queries Xero for invoices matching motors installed approximately two years ago. It loops through each result and extracts the contact details, motor type, and install date.

**Step 2: Check for a recent service visit**
For each customer, the automation searches Google Calendar for any service event linked to that invoice in the past 24 months. If a service visit has already occurred, the customer is skipped and no reminder is sent.

**Step 3: Route to the right recipient**
The automation reads the property management flag from the Xero contact. If the property is managed by a real estate agent, the reminder is routed to the agent's email address. If not, it goes to the property owner.

**Step 4: Send the correct email template**
Six email templates, one per motor type, are configured in the system. The automation selects the correct template based on the motor type field in Xero and sends it via Gmail.

**Step 5: Review list (optional)**
Before sending, the automation generates a review list for your approval. Once you're satisfied the system is working correctly, this step can be switched off.

---

## What's Included

| Component | Description |
|---|---|
| Xero - Invoice Search | Connecting Xero, configuring the 2-year date window, and mapping invoice fields into the automation loop |
| Google Calendar - Service Check | Searching Calendar for service events by invoice reference and stopping the flow if a recent visit is found |
| Recipient Routing | Reading the property management flag from Xero and routing each reminder to the correct email address |
| Gmail - 6 Email Templates | Building six branches (one per motor type) with filter conditions and Gmail send modules wired to the correct recipient |
| Automation Config & Scheduling | Setting the weekly trigger, error handling, auto-commit, and a full end-to-end test run with real Xero data |
| Testing | End-to-end test runs across motor types and routing scenarios |
| Blueprint & Documentation | Exportable scenario file (JSON) and a short setup guide covering how to reconnect accounts, update motor type names, and adjust the date window |

---

## Investment

| | |
|---|---|
| **Estimated hours** | 20 hours |
| **Rate** | $180 per hour |
| **Total** | **$3,600 + GST** |

This estimate is based on a midpoint of the project scope. If any data quality issues are discovered during the Xero audit (for example, inconsistencies in how motor types or property management flags are recorded), we will flag this before proceeding rather than absorbing the time without your knowledge.

**Note:** Make.com subscription costs are separate to this quote. We will confirm the appropriate plan with you prior to setup.

---

## What We Need From You

To get started, we'll need the following:

1. **Access to your Xero account:** read access to contacts and invoices
2. **Access to your Google Calendar and Gmail:** for the service check and sending
3. **Confirmation of the trigger logic:** we're working on the assumption that the reminder fires 2 years from the install invoice date; please confirm this is correct
4. **Your 6 email templates:** one per motor type, as you'd like them to read. We can assist with writing these if needed (quoted separately)
5. **Property management flag confirmation:** confirmation of how real estate-managed properties are currently tagged in Xero (e.g. contact group, custom field)

---

## Next Steps

1. Review and approve this proposal
2. Provide the access and information listed above
3. We complete a short Xero data review to confirm the automation logic will map cleanly to your existing data
4. Build, test, and deliver

Please don't hesitate to get in touch with any questions. We're looking forward to getting this off your plate.

---

*Mettro Digital | mettro.com.au*
