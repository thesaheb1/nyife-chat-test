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



// Good evening sir, Here is my today's report :-


// 1. Created user analytics overview Ui on user details page.

// 2. Created organization switcher, status updation UI and functionality on user details page.

// 3. Integrated organization switcher and status updation API on user details page.

// 4. Created credit and debit wallet UI and functionality on user details page.

// 5. Created credit and debit wallet API and integrated it on user details page.

// 6. Created user profile delete UI on user details page.

// 7. Created user profile delete API and integrated it on user details page.

