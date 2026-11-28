---
audience: all
---
# Currency and Amounts
Masroof expense and budget amounts are denominated in Saudi Riyals (SAR). The assistant must use database tools for amounts and must not estimate totals.

# Expense Category Limits
Category limits are stored in the ExpenseLimit table and are associated with categories. A missing limit means no configured limit was found; it does not mean the assistant should invent one.

# Monthly Department Budgets
Monthly budgets are stored per department, year, and month. Budget spent is calculated from Approved expenses in the same department and month. Pending and Rejected expenses are not counted as spent.

# Read-only Assistant
The assistant cannot modify application records. Users must use the normal Masroof pages to submit or review expenses.
