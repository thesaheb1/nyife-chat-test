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



// BUG:
// 1. We register a new user account as user. and then admin recharge my wallet. i took monthly subscription.
// the i chat with admin using support desk by raising a ticket. and i got a message from admin. then 
// i created a new team member in my organization. and i invited him to my organization. and when team member logged in. he can see my support chat message with admin.
// which is a biggest bug in my system. i can see my support chat message with admin. and other should not see it.
// team member can see their own support chat message with admin. and i should not see it.

// 2. When user try to delete his team member account. it gave below error but when i refresh the page team member is deleted and table is empty.

// {
//     "success": false,
//     "message": "Validation failed",
//     "stack": "AppError: Validation failed\n    at AppError.internal (/app/shared/shared-utils/src/AppError.js:87:12)\n    at syncTeamSeatUsage (/app/services/organization-service/src/services/organization.service.js:254:20)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at async Object.removeTeamMember (/app/services/organization-service/src/services/organization.service.js:993:3)\n    at async removeTeamMember (/app/services/organization-service/src/controllers/organization.controller.js:205:3)"
// }

// this was the API : 

// Request URL : https://localhost:5173/api/v1/organizations/8e08090e-d176-4e39-9ef8-c6ceeb3c67cd/members/035bb699-7527-4143-83df-a7be3db20988
// Request Method : DELETE
// Status Code : 500 Internal Server Error


// 3. after account is deleted by user when team member refresh the page on logged in account. it just loading and showing no content.

// 4. when user try to create again team member account. with same email id. it created but team member is not able to login. giving this error.

// {
//     "success": false,
//     "message": "Invitation not found or already used.",
//     "stack": "AppError: Invitation not found or already used.\n    at AppError.notFound (/app/shared/shared-utils/src/AppError.js:67:12)\n    at findInvitationByToken (/app/services/organization-service/src/services/organization.service.js:759:20)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at async Object.acceptInvitation (/app/services/organization-service/src/services/organization.service.js:771:22)\n    at async acceptInvitation (/app/services/organization-service/src/controllers/organization.controller.js:129:18)"
// }

// FIXES:
// 1. user and team member should not able to see each other's support chat message.
// 2. user can delete team member account without any single error. 
// 4. After team member account deletion the team member should be logged out when he refresh the page.
// 3. team member account must be deleted completely so new account can we created and logged in with same email id.
// 4. team member account must not have access of team members module and organizations module. even user can't give access to these module while creating account.

// NOTE : FIX ALL BUGS AND CHECK THAT ALL FIXES ARE DONE


