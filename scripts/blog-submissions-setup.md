# Blog Submission Backend Setup

The blog contributor page posts to the same Google Apps Script web app used by secondary article submissions.

Create a Google Sheet tab named:

```text
Blog_Submissions
```

Add these headers in row 1:

```text
id
status
submittedAt
title
subtitle
category
body
images
author
authorName
contactEmail
anonymous
editorNotes
slug
approvedAt
approvedBy
rejectedAt
rejectedBy
rejectionReason
```

Apps Script properties needed:

```text
SHEET_ID
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
ARTICLES_PATH
BLOG_POSTS_PATH
ADMIN_CODE
```

Recommended:

```text
BLOG_POSTS_PATH = data/blog_posts.json
```

After updating the Apps Script with `scripts/secondary-submissions-apps-script.gs`, deploy a new web app version. The public writer page submits with `submitBlogPost`; the admin Blog Review tab uses `listPendingBlog`, `approveBlogPost`, and `rejectBlogPost`.

When a blog post is approved, the script now updates:

```text
data/blog_posts.json
blog/{post-slug}.html
```

The `blog/{post-slug}.html` file is a small static page with share metadata and a redirect into:

```text
https://echoesofgaza.org/blog?post={post-slug}
```

The stable public link displayed by the site uses the blog app route:

```text
https://echoesofgaza.org/blog?post=example-post-title
```

The `blog/{post-slug}.html` file remains only as a metadata/redirect helper.
