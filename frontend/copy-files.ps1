# Copy frontend files from worktree to XAMPP
$source = "C:\Users\User\.windsurf\worktrees\attendance\attendance-28fd6d99\frontend\src"
$dest = "C:\xampp\htdocs\attendance\frontend\src"

# Services
Copy-Item "$source\services\csv-employees.service.ts" "$dest\services\csv-employees.service.ts" -Force

# Employee Address Form
Copy-Item "$source\app\employee-address\[id]\page.tsx" "$dest\app\employee-address\[id]\page.tsx" -Force

Write-Host "Frontend files copied successfully!"
