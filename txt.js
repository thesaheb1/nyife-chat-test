// TEMPLATE MODULE ON USER PANLE

// earlier we work on template module but now we have completed all the functionality and requirements. 
// so we will work on template module to make template module flexible, dynamic and easy to use.
// currently we are only creating and viewing template module but we need to implement all the functionality and requirements supported by meta graph api.
// first you have to read complete requirements and cross check with implemented functionality in template codebases.
// then you have to read meta graph api documentation for manage template such as create, update, delete, sync, publish, etc.
// create list of their functionality and new requirements with check list so we can verification it after work done if anything is remain we will work again.
// if any new requirements required major changes then discuss with me first before implementation.

// Now let's work on organization module on user panel. 

// REQUIREMENTS:
// 1. Read meta graph api documentation for manage teample such as create, update, delete, etc.
// 2. user must be able to create, update, delete, view, sync and publish action on template based on their status.
// because meta prevent some action on template based on their status.
// 3. tempalte table must have action column to store action such as create, update, delete, sync, publish, etc.
// 4. clean unused or unnecessary code. 
// 5. handle error, success and loading state for all the action in toast with production grade approach.
// 6. code implementation must be clean, readable, maintainable, modular, and most importantly, reusable.
// 7. don't make one big component. make it many small modular and reusable compoents.

// TODO:
// Can we implement ON DELETE CASCADE that automatically deletes related rows in child tables when a row in the parent table is deleted.It ensures referential integrity, preventing "orphan" records and simplifying data cleanup.
// such as if i delete a user account then all its organizations, team members, invitations, wallets, subscriptions and support tickets etc should be deleted automatically.
// so we can avoid manual cleanup.
// and when we delete a team member then all its conversations should be deleted automatically.
// and when we delete an organization then all its team members, invitations, wallets, subscriptions and support tickets etc should be deleted automatically.
// and when we delete a sub admin then all its conversations should be deleted automatically.

// NOTE : create comprehensive production grade plan and implement all these requirements. make sure that implementation is complete production garde also .
// IMPORTANT NOTE : if any new requirements required major changes then discuss with me first before implementation.





// BUGS:
// 1. first read meta graph api documentation for manage template such as create, update, delete, sync, publish, etc.
// 2. meta graph api documentation url : https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management
// 3. does meta restrict update action on template if status is not approved or rejected? if no then why my Ui action prevent me to edit approved template?

// IMPROVEMENTS:
// 1. view template Ui page is so basic. please make it more visually appealing, professional and user friendly.
// 2. template create/edit page language selection dropdown is not scalable and responsive. please make it responsive and scalable. so it can't hide language options.
// 3. All template related page must be responsive and scalable. for mobile, tablet and desktop.

// 1. Again action dropdown has no edit option for approved template. so it can't edit approved template.
// 2. Template create/edit page language selection dropdown should scroll and responsive. so it can't hide language options. currently it is not scrollable. please fix it.
// 3. find all the bugs in template module and fix them. compare with meta graph api documentation and fix it.
// 4. template action dropdown must be consistent Ui like other action dropdown in other pages.
// 5. Consistency is most important. So please make all the action dropdown consistent.
// --------------------------------------------------------------------------------------------------------------------------------


// CONTEXT: we previously implement template module on user panel where we can create standard, authentication, carousel and list template. but we never tested manually that template creation, updation, deletion and publish is working or not but now when i tested a template by creating a standard template it is created but giving error when publishing to meta. we need to make it fully working, more flexible, dynamic and easy to use.
// first you have to read complete requirements and cross check with implemented functionality in template codebases.
// then you have to read meta graph api documentation for manage template such as create, update, delete, publish, etc.
// create list of their functionality and new requirements with check list so we can verification it after work done if anything is remain we will work again.

// ERRORS:
// 1. When i try to submit a standard template with language as English(US) and category as MARKETING to meta. it gives me error.
// basically this template includes header component with media type as image and sample media.

// here is the error response : 
// {
//     "success": false,
//     "message": "Unable to load the selected header sample from Nyife media storage. No accessible organization was found for this account.",
//     "stack": "AppError: Unable to load the selected header sample from Nyife media storage. No accessible organization was found for this account.\n    at AppError.badRequest (/app/shared/shared-utils/src/AppError.js:37:12)\n    at fetchMediaRecord (/app/services/template-service/src/services/template.service.js:497:20)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at async uploadTemplateHeaderSample (/app/services/template-service/src/services/template.service.js:571:23)\n    at async sanitizeTemplateComponentsForMeta (/app/services/template-service/src/services/template.service.js:702:27)\n    at async buildMetaTemplatePayload (/app/services/template-service/src/services/template.service.js:809:17)\n    at async Object.publishTemplate (/app/services/template-service/src/services/template.service.js:1485:19)\n    at async publishTemplate (/app/services/template-service/src/controllers/template.controller.js:91:20)"
// }

// API GATEWAY :

// Request URL : https://localhost:5173/api/v1/templates/d1d9d98d-72f1-4cde-8c2f-7b77f76b2f02/publish
// Request Method : POST
// Status Code : 400 Bad Request


// REQUIREMENTS:
// 1. Read meta graph api documentation for manage template such as create, update, delete, publish, etc.
// 2. user must be able to create, update, delete, view and publish action on template based on their status. because meta prevent some action on template based on their status.
// 3. Fixed the error with production grade approach not just quick fix. find the root cause and fix it with production grade approach.
// 4. code implementation must be clean, readable, maintainable, modular, and most importantly, reusable.
// 5. don't make one big component. make it many small modular and reusable compoents.

// CONTEXT : Our system is supposed to have only one Whatsapp account/WABA in a organization. So we can't have multiple WABA accounts in one organization.
// also we can have multiple phone numbers in one WABA account as per subscription plan limit.

// ERRORS:
// 1. when i try to update a draft template it gaves me error.

// {
//     "success": false,
//     "message": "Only one active WhatsApp account/WABA can be connected per organization for templates and flows. Disconnect extra accounts before continuing.",
//     "stack": "AppError: Only one active WhatsApp account/WABA can be connected per organization for templates and flows. Disconnect extra accounts before continuing.\n    at AppError.badRequest (/app/shared/shared-utils/src/AppError.js:37:12)\n    at buildMultipleWabaError (/app/services/template-service/src/services/waAccountContext.service.js:17:19)\n    at assertSingleActiveAccountInvariant (/app/services/template-service/src/services/waAccountContext.service.js:41:11)\n    at resolveSingleWabaAccount (/app/services/template-service/src/services/waAccountContext.service.js:105:3)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at async requireActiveWaAccount (/app/services/template-service/src/services/template.service.js:443:21)\n    at async Object.updateTemplate (/app/services/template-service/src/services/template.service.js:1184:29)\n    at async updateTemplate (/app/services/template-service/src/controllers/template.controller.js:63:20)"
// }

// Api Gateway :
// Request URL : https://localhost:5173/api/v1/templates/d1d9d98d-72f1-4cde-8c2f-7b77f76b2f02
// Request Method : PUT
// Status Code : 400 Bad Request


// Again when i try to publish a template it gives me error.

// API Gateway :
// Request URL : https://localhost:5173/api/v1/templates/d1d9d98d-72f1-4cde-8c2f-7b77f76b2f02/publish
// Request Method : POST
// Status Code : 400 Bad Request

// Payload : {"wa_account_id":"15bf50f1-2ad6-4fd5-ab62-a41894fe7932"}

// response error :
// {
//     "success": false,
//     "message": "Meta API error: Invalid parameter - Message template button combination not supported. Either the number of buttons exceeded the limit, or there was an invalid button type used in the carousel card.",
//     "stack": "AppError: Meta API error: Invalid parameter - Message template button combination not supported. Either the number of buttons exceeded the limit, or there was an invalid button type used in the carousel card.\n    at AppError.badRequest (/app/shared/shared-utils/src/AppError.js:37:12)\n    at Object.publishTemplate (/app/services/template-service/src/services/template.service.js:1575:22)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at async publishTemplate (/app/services/template-service/src/controllers/template.controller.js:92:20)"
// }

// FIXES: 
// 1. Review the complete and all types of templates parameter and Compare with meta graph api documentation and fix it.
// 2. When i upload any media file such as image, video, document etc. then save the template. and then open that template in edit mode the media header is not showing. it only showing file name. please fix it.



// When i open a draft template to edit and When i uploaded any media file such as image, video, document etc in the header component then the media is not showing. it only showing file name. please fix it.
// I have attached the screenshot of the issue.



// When i try to publish a authentication template it gives me error.

// API Gateway :
// Request URL : https://localhost:5173/api/v1/templates/227f09b9-80dd-494e-8c69-67305c4c0dd1/publish
// Request Method : POST
// Status Code : 400 Bad Request

// Payload : {"wa_account_id":"15bf50f1-2ad6-4fd5-ab62-a41894fe7932"}

// response error :
// {
//     "success": false,
//     "message": "Meta API error: Invalid parameter - Button format is incorrect. Buttons can't have any variables, newlines, emojis or formatting characters.",
//     "stack": "AppError: Meta API error: Invalid parameter - Button format is incorrect. Buttons can't have any variables, newlines, emojis or formatting characters.\n    at AppError.badRequest (/app/shared/shared-utils/src/AppError.js:37:12)\n    at Object.publishTemplate (/app/services/template-service/src/services/template.service.js:1625:22)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at async publishTemplate (/app/services/template-service/src/controllers/template.controller.js:92:20)"
// }

// FIXES : 
// 1. Review template creation/updation code and compare with meta graph api documentation and find the root cause of the error.
// 2. When a template is created/updated as draft and when i try to publish it must not give me error. it must give me success response.
// All checks & validations must be done at the time of template draft creation/updation. so when we try to publish it must not give any error.

// I deleted a authentication template and then i created a new authentication template named auth_testing but it only deleted from locally from my DB not from meta. it must be deleted from meta also. please fix it. when we delete a template then it must be deleted from meta also. and when we update a template then it must be updated on meta also. and when we publish a template then it must be published on meta. so all the action must be performed on meta also not just locally on our DB. because our system is just a middleware between user and meta. so all the action must be performed on meta also not just locally on our DB. please fix it with production grade approach not just quick fix. find the root cause and fix it with production grade approach.

// Read this whatsapp carousel template documentation and compare with our implementation and find the missing parameters and functionality and then implement it. so our carousel template must be fully compatible with meta graph api documentation. so we can't get any error while creating, updating and publishing carousel template. here is the documentation url : https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/media-card-carousel-templates/


// Read this whatsapp authentication template documentation and compare with our implementation and find the missing parameters and functionality and then implement it. so our authentication template must be fully compatible with meta graph api documentation. so we can't get any error while creating, updating and publishing authentication template. here is the documentation url : https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates/

// there are few issue in the template module. please understand the issue and find the root cause and fix it with production grade approach not just quick fix. here are the issues :
// 1. when i upload any media file such as image, video, document etc. then save and publish the template. and then open that template in preview mode or edit mode the media header is not showing. it only showing file name. it must show the media header with media. please fix it.
// 2. In whatsapp template preview UI the carousel template is not showing properly. it must show exactly like react whatsapp show exactly. i have attached a gif file to understand better how our carousel preview Ui must look like. please fix it.


// 1. Now it become worst even image is not showing in whatsapp template preview and Still video header is not showing in template preview. it only showing file name you can see attached screenshot. please fix it with production grade approach not just quick fix. find the root cause and then fix it with production grade approach.
// 2. I said that the other UI such Validation checklist and subscription Ui should not hidden and must be visible. please fix it with production grade approach not just quick fix. currently it is hiding behind the whatsapp template preview UI.
// we should show the validation checklist and subscription Ui at the place where user can see it easily. currently it is bottom of the whatsapp template preview UI and user need to explictly scroll screen in order to find that Ui but i want to show these Ui in one go. please fix it with production grade approach not just quick fix.
// also i don't like left and right section of from it should be vertically aligned instead of horizontally. please make it vertically aligned instead of horizontally. so it will look more better and more user friendly. please fix it with production grade approach not just quick fix.
