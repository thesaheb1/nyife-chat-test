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



// BUGS:
// 1. super admin created sub admin account then super admin delete that sub admin account.
// but when super admin try to create again that sub admin account with same email then it says "email already exists".
// error : 

// {
//     "success": false,
//     "message": "A user with this email already exists",
//     "stack": "AppError: A user with this email already exists\n    at Object.createSubAdmin (/app/services/admin-service/src/services/admin.service.js:454:11)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at async createSubAdmin (/app/services/admin-service/src/controllers/admin.controller.js:90:18)"
// }

// FIXES:
// 1. super admin can create sub admin account then super admin can delete that sub admin account and then super admin can recreate that sub admin account with same email.
// 2. super admin can take these actions in sub admin table like : edit, delete, active, inactive.
// 3. if super admin delete sub admin account then sub admin account should be deleted from database table "auth_users" also so we can re-create account again.
// 4. if super admin make sub admin account inactive then sub admin account should not be able to login untill sub admin account is active.
// 5. in invite tab of sub admin table super admin can take these actions : resend invite email, revoke invite or vise versa, delete invite same actions can be taken on user invite on user page by admin.
// 6. also in user panel user can take these actions on team member table like : edit, delete, active, inactive.
// 7. in user panel in team member in invite tab user can take these actions : resend invite email, revoke invite or vise versa, delete invite.

// NOTE : create comprehensive production grade plan and fix all bugs then check that all fixes is completed. make sure that implementation is complete production garde.

// BUGS:
// 1. when i deleted sub admin account, admin and sub admin invitation on frontend then it is deleted and data gone from table but in db it is there and only deleted_at field is updated.
// why we are not deleting data from db? same happened with user invitation by admin and team member invitation by user.

// BUGS :
// 1. A user try to register account with "saheb@gmail.com" email. a verification email is sent to "saheb@gmail.com" but user realizes that "saheb@gmail.com" is not a their email address.
// they have entered wrong email address and then change it to "saheb786@gmail.com" and try to register account again. now a verification email is sent to "saheb786@gmail.com". user verifies the email and then try to login with "saheb786@gmail.com" email.
// and user got sussessfull login but there is a bug that if the user who has "saheb@gmail.com" email can't able to register now because someone already try register with "saheb@gmail.com" email even though email "saheb786@gmail.com" is not verified yet.
// so we need to fix this bug. untill email is not verified then the account can be register again with same name, phone or different.

// IMPROVEMENTS:
// 1. in entire frontend codebases the password field must have password visibility toggle button so user can see password and hide password easily and implemented with production grade security.
// 2. register page or any other page where we are setting password must have password strength meter so user can see password strength easily match with our frontend and backend password validation.
