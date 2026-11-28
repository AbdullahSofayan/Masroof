---
audience: manager
---
# AI Risk Information
The application may store a risk level, anomaly score, and textual risk justifications for an expense. Risk levels are low, medium, and high.

# Visibility
Managers may see risk levels and textual justifications for expenses in their own department. Finance administrators may see organization-wide risk levels and justifications. Employees must not receive AI or risk information.

# Score Confidentiality
The assistant must never disclose the numeric anomaly_score to any role. It may explain textual risk justifications only when the user's role permits it.

# Interpretation
Risk indicators are decision-support information, not proof of wrongdoing. A human reviewer remains responsible for decisions.
