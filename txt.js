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


// TODO:
// Can we implement ON DELETE CASCADE that automatically deletes related rows in child tables when a row in the parent table is deleted.It ensures referential integrity, preventing "orphan" records and simplifying data cleanup.
// such as if i delete a user account then all its organizations, team members, invitations, wallets, subscriptions and support tickets etc should be deleted automatically.
// so we can avoid manual cleanup.
// and when we delete a team member then all its conversations should be deleted automatically.
// and when we delete an organization then all its team members, invitations, wallets, subscriptions and support tickets etc should be deleted automatically.
// and when we delete a sub admin then all its conversations should be deleted automatically.

// NOTE : create comprehensive production grade plan and implement all these requirements. make sure that implementation is complete production garde also .
// IMPORTANT NOTE : if any new requirements required major changes then discuss with me first before implementation.


// TODO:

// BUGS :
// 1. A user try to register account with "saheb@gmail.com" email. a verification email is sent to "saheb@gmail.com" but user realizes that "saheb@gmail.com" is not a their email address.
// they have entered wrong email address and then change it to "saheb786@gmail.com" and try to register account again. now a verification email is sent to "saheb786@gmail.com". user verifies the email and then try to login with "saheb786@gmail.com" email.
// and user got sussessfull login but there is a bug that if the user who has "saheb@gmail.com" email can't able to register now because someone already try register with "saheb@gmail.com" email even though email "saheb786@gmail.com" is not verified yet.
// so we need to fix this bug. untill email is not verified then the account can be register again with same name, phone or different.

// IMPROVEMENTS:
// 1. in entire frontend codebases the password field must have password visibility toggle button so user can see password and hide password easily and implemented with production grade security.
// 2. register page or any other page where we are setting password must have password strength meter so user can see password strength easily match with our frontend and backend password validation.


// TODO :

// ERRORS : 
// i as a user want to recharge my wallet from my wallet page but i am not able to recharge because API giving error : 

// API Gateway :
// Request URL : https://localhost:5173/api/v1/wallet/recharge
// Request Method : POST
// Status Code : 500 Internal Server Error

// ERROR : 

// {"success":false}

// PAYLOAD : 

// {"amount":500}

// TODO:

// Now getting 500 error while reloading wallet page.

// error : {"success":false,"message":"Internal server error"}

// API Gateway :
// Request URL : https://localhost:5173/api/v1/wallet
// Request Method : GET
// Status Code : 500 Internal Server Error

// same in these api
// Request URL : https://localhost:5173/api/v1/wallet/transactions?page=1&limit=20
// Request Method : GET
// Status Code : 500 Internal Server Error

// Request URL : https://localhost:5173/api/v1/wallet/invoices?page=1&limit=20
// Request Method : GET
// Status Code ; 500 Internal Server Error


// TODO:
// 1. in our current project phone number is optional and it is not unique. so if we want to register user with phone number then we have to check if phone number is unique or not. if it is unique then we can register user with phone number otherwise we can not register user with phone number.
// Implement this in our project safely by first reviewing the codebase implementation and then implementing it.

// 2. We have lots of form right now in our project. so we have to review all form validation in our project safely by first reviewing the codebase implementation and then do fixing if required.
// 3. Also all required field must has asterisk sign.
// 4. Submit button must have disabled state when form is not filled completely and untill all required field is filled.
// NOTE: make a comprehensive plan and implement all these requirements. make sure that implementation is complete with production garde and optimized approach.


