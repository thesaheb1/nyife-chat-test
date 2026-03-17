// SUPPORT DESK ON ADMIN PANEL & USER 

// we have completed User module in admin panel. Now we will work on admin panel to make admin panel flexible, dynamic and easy to use.
// so it must manage most of the user's and site module's such as users, plans, coupons, teams, organizations, support and etc.
// you have to read complete requirements and cross check with implemented functionality in codebases.
// create list of module's and their functionality and new requirements with check list so we can verification it after work done if anything is remain we will work again.
// if any new requirements required major changes then discuss with me first before implementation.

// Now let's work on support desk in admin panel & user. 

// REQUIREMENTS:
// 1. The Support Desk Ui should look like a realtime chat app.
// 2. The Support Desk should be able to send and receive messages.
// 3. Whenever a new message is received, the Support Desk should display it in the chat window in realtime without refreshing the page.
// 4. Support sidebar text must show new unread message count badage at sidebar in both user and admin panel.
// 5. Admin can assign chat to subadmin using drowdown menu.
// 6. User can rate chat using star rating after ticekt resolved.
// 7. In admin panel Support ticket list must have action button with option to open ticket, assign ticket to subadmin, update ticket status, delete ticket.
// 8. In User panel user support ticket list must have action button with option to open ticket, rate resolved ticket.
// 9. it must be built using websokets, kafka and other technologies with realtime support and production grade approach and scalability.


// GOT THESE ERROR IN API's WHEN OPEN SUPPORT MODULE IN USER AND AMDIN : 

// USER SIDE ERROR : 

// 1.

// {
//     "success": false,
//     "message": "Validation failed",
//     "errors": [
//         {
//             "field": "id",
//             "message": "Invalid ticket ID"
//         }
//     ],
//     "stack": "ZodError: [\n  {\n    \"validation\": \"uuid\",\n    \"code\": \"invalid_string\",\n    \"message\": \"Invalid ticket ID\",\n    \"path\": [\n      \"id\"\n    ]\n  }\n]\n    at get error [as error] (/app/node_modules/zod/v3/types.cjs:45:31)\n    at ZodObject.parse (/app/node_modules/zod/v3/types.cjs:120:22)\n    at getTicket (/app/services/support-service/src/controllers/support.controller.js:75:32)\n    at /app/shared/shared-middleware/src/asyncHandler.js:23:21\n    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)\n    at next (/app/node_modules/express/lib/router/route.js:149:13)\n    at /app/shared/shared-middleware/src/rbacMiddleware.js:31:14\n    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)\n    at next (/app/node_modules/express/lib/router/route.js:149:13)\n    at Route.dispatch (/app/node_modules/express/lib/router/route.js:119:3)"
// }


// Request URL : https://localhost:5173/api/v1/support/tickets/unread-count
// Request Method : GET
// Status Code : 400 Bad Request


// 2. 

// {"success":false,"message":"Route not found"}


// Request URL : https://localhost:5173/api/v1/support/tickets/6bda5bcc-2058-4fee-884a-94a1c9f05a0d/read
// Request Method : POST
// Status Code : 404 Not Found


// 3. 

// {"success":false,"message":"Route not found"}

// Request URL ; https://localhost:5173/api/v1/support/tickets/6bda5bcc-2058-4fee-884a-94a1c9f05a0d/messages?page=1&limit=30
// Request Method : GET
// Status Code : 404 Not Found


// ADMIN SIDE ERORR : 

// 1. 

// {
//     "success": false,
//     "message": "Validation failed",
//     "errors": [
//         {
//             "field": "id",
//             "message": "Invalid ticket ID"
//         }
//     ],
//     "stack": "ZodError: [\n  {\n    \"validation\": \"uuid\",\n    \"code\": \"invalid_string\",\n    \"message\": \"Invalid ticket ID\",\n    \"path\": [\n      \"id\"\n    ]\n  }\n]\n    at get error [as error] (/app/node_modules/zod/v3/types.cjs:45:31)\n    at ZodObject.parse (/app/node_modules/zod/v3/types.cjs:120:22)\n    at adminGetTicket (/app/services/support-service/src/controllers/support.controller.js:145:32)\n    at /app/shared/shared-middleware/src/asyncHandler.js:23:21\n    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)\n    at next (/app/node_modules/express/lib/router/route.js:149:13)\n    at /app/shared/shared-middleware/src/adminAuthorization.js:95:16\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)"
// }

// Request URL : https://localhost:5173/api/v1/admin/support/tickets/assignable-admins
// Request Method : GET
// Status Code : 400 Bad Request

// 2.

// {"success":false,"message":"Route not found"}

// Request URL : https://localhost:5173/api/v1/admin/support/tickets/6bda5bcc-2058-4fee-884a-94a1c9f05a0d/messages?page=1&limit=30
// Request Method : GET
// Status Code : 404 Not Found


// 3.

// {"success":false,"message":"Route not found"}

// Request URL : https://localhost:5173/api/v1/admin/support/tickets/6bda5bcc-2058-4fee-884a-94a1c9f05a0d/read
// Request Method : POST
// Status Code : 404 Not Found


// Please do a deep review and cross check what we missed in the requirements. that it causes the error. find out fix with production grade approach and test it before marking it complete.
// Chat, sidebar support badge, and ticket message count badge is not showing in realtime everytime i need to refresh page. the user and admin must be able to do realtime chat.
// show user and organization daetail in admin panel support ticket. so admin can see user and organization details in ticket.
// Make this module complete responsive for mobile, tablet and desktop.
// the chat window must have infinite scroll or load more button for seeing older chat messages.
// Remember Realtime chat and badge count is most important requirement. please fullfilled it with production grade and scalable pattern.

// ticket list is overflowing from layout.
// chat is overflowing from chat window layout.
// please make it is scrollable and responsive for mobile, tablet and desktop. and make it scalable.
// when i open support ticket chat window in tablet or mobile and click "Back to tickets" button it is showing same Ui which is chat window instead it must show ticket list UI.


// I did some changes in admin and user support desk which is making Ui clean by commenting redundant data and code.
// currently the issue i am facing is responsive and scalability of the support desk.
// ticket card is overflowing from layout when user enter subject too long. please make it scalable.
// in tablet and mobile view chat window doesn't have scroll bar and max height. please make it scrollable and scalable.
// analyze the complete support desk code and make it scalable and responsive for mobile, tablet and desktop.


// In admin support desk we are showing user name and organization name at the top. please make it as redirection ui so when we click on it it goes user detail page with same organzation selected which was message arrived.

// Once a chat is resolved or closed then both user or admin must not able to chat again with same ticket untill admin reopen it. also when chat is resolved or closed the user give rating and feedback but the admin is not able to see it so he can review who performing best please handle this part also with production grade approach



