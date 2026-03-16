// COUPON MANAGEMENT MODULE ON ADMIN PANEL

// we have completed User module in admin panel. Now we will work on admin panel to make admin panel flexible, dynamic and easy to use.
// so it must manage most of the user's and site module's such as users, plans, coupons, teams, organizations, support and etc.
// you have to read complete requirements and cross check with implemented functionality in codebases.
// create list of module's and their functionality and new requirements with check list so we can verification it after work done if anything is remain we will work again.
// if any new requirements required major changes then discuss with me first before implementation.

// Now let's work on coupon management in admin panel. 

// REQUIREMENTS:
// 1. currently in admin panel there is coupon module where we are listing coupons in table but it is giving error while fetching coupons.

// Request URL : https://localhost:5173/api/v1/admin/coupons
// Request Method : GET
// Status Code : 500 Internal Server Error

// RESPONSE : 

// {
//     "success": false,
//     "message": "Unknown column 'deleted_at' in 'where clause'",
//     "stack": "Error\n    at Query.run (/app/node_modules/sequelize/lib/dialects/mysql/query.js:52:25)\n    at /app/node_modules/sequelize/lib/sequelize.js:315:28\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at async Object.listCoupons (/app/services/admin-service/src/services/admin.service.js:1667:27)\n    at async listCoupons (/app/services/admin-service/src/controllers/admin.controller.js:449:26)"
// }

// 2. please fix this module so we can list, search, filter, create, edit, update status, and delete coupons in admin panel.