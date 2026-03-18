// ORGANIZATIONS ON USER PANEL

// we have completed support module in user & admin panel. Now we will work on user panel to make user panel flexible, dynamic and easy to use.
// so it must manage most of the user's and site module's such as users, plans, organizations, support and etc.
// you have to read complete requirements and cross check with implemented functionality in codebases.
// create list of module's and their functionality and new requirements with check list so we can verification it after work done if anything is remain we will work again.
// if any new requirements required major changes then discuss with me first before implementation.

// Now let's work on organization module on user panel. 

// REQUIREMENTS:
// 1. We can create organizations using only name & description. no need of logo url.
// 2. Organization listing table must have columns such as name, description, createdAt, updatedAt, Actions like edit and switch.
// 3. currently when we register a new user account it will create a default organization with name "dafault" and description "default organization". but now it should create organization with name "${username first name}'s Org" and description "${username first name}'s first organization".
// example: if user name is "Saheb" then organization name will be "Saheb's Org" and description "Saheb's first organization".
// 4. In user sidbar in active organization section should show organization name and description instead "Owner workspace" text.


// ISSUES
// 1. when i click on edit button to edit organization it is redirecting to this page : https://localhost:5173/organizations/d25c54fd-8cca-44a7-a015-3e4af0302675
// which says "page not found".

// MODIFICATION
// 1. you have added invite button in oragznization edit page in team member section its great but
// i don't know how to invite user in this page so please just redirect to invite page. and remove all invite dialog code in order to make it clean and simple.

// BUGS
// 1. when i try to delete a team member from oragnization edit page it gives me error "Validation failed." but it deleted successfully.
// 2. when i again invite same team member in same oragnization after deleting. it is invited successfully but when i open invite email url it show set password when i set password and submit. it says "user already exists" Whereas i have deleted that team member.
// then i manually deleted team member account from database auth_user table and refresh url and again set password and submit. it works fine.
// but when i again try to delete same team membar again it says "Organization not found"
// below is the error : 
// {
//     "success": false,
//     "message": "Organization not found",
//     "stack": "AppError: Organization not found\n    at AppError.notFound (/app/shared/shared-utils/src/AppError.js:67:12)\n    at ensureOwnerOrganization (/app/services/organization-service/src/services/organization.service.js:116:20)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at async Object.removeTeamMember (/app/services/organization-service/src/services/organization.service.js:967:3)\n    at async removeTeamMember (/app/services/organization-service/src/controllers/organization.controller.js:205:3)"
// }
// NOTE : i must be able to delete team member, re invite same team member and again delete same team member.