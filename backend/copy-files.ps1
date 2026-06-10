# Copy all fixed files from worktree to XAMPP
$source = "C:\Users\User\.windsurf\worktrees\attendance\attendance-28fd6d99\backend\src\modules"
$dest = "C:\xampp\htdocs\attendance\backend\src\modules"

Copy-Item "$source\attendance\attendance.controller.ts" "$dest\attendance\attendance.controller.ts" -Force
Copy-Item "$source\attendance\attendance.service.ts" "$dest\attendance\attendance.service.ts" -Force
Copy-Item "$source\employee-addresses\employee-addresses.service.ts" "$dest\employee-addresses\employee-addresses.service.ts" -Force
Copy-Item "$source\employee-education\employee-education.service.ts" "$dest\employee-education\employee-education.service.ts" -Force
Copy-Item "$source\employee-policy-tagging\dto\create-policy-tagging.dto.ts" "$dest\employee-policy-tagging\dto\create-policy-tagging.dto.ts" -Force
Copy-Item "$source\employee-policy-tagging\employee-policy-tagging.service.ts" "$dest\employee-policy-tagging\employee-policy-tagging.service.ts" -Force
Copy-Item "$source\employee-salary-information\employee-salary-information.service.ts" "$dest\employee-salary-information\employee-salary-information.service.ts" -Force
Copy-Item "$source\employees\dto\create-employee.dto.ts" "$dest\employees\dto\create-employee.dto.ts" -Force
Copy-Item "$source\employees\employees.service.ts" "$dest\employees\employees.service.ts" -Force

Write-Host "All files copied successfully!"
