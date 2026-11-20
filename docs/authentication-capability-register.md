# Identity authentication capability register

Owner-requested product scope: 135 numbered acceptance requirements. This is a requirements register, not a claim that all capabilities exist. Each item requires source implementation and appropriate verification before being marked production-ready. Existing source is not proof of runtime behaviour. Provider-dependent features must be configurable; no automatic paid SMS, KYC or enterprise services. Preserve privileged MFA and tenant isolation. Availability responses must not expose private account existence; support impersonation requires explicit constrained authorization, audit and no access to secrets or billing; password expiry is optional policy, not default. Phone/guest/invite flows must reconcile with existing verified-email and account-deletion policy before enabling. Testing is a product requirement; no live testing is authorized in this engineering session.

## A. Account creation

1. [ ] Email/password signup
2. [ ] Username signup
3. [ ] Phone signup with SMS verification
4. [ ] Social signup Google Apple Facebook
5. [ ] Magic link
6. [ ] Email OTP
7. [ ] Passkeys
8. [ ] Local biometric unlock
9. [ ] Anonymous account and conversion
10. [ ] Invite-only signup and waitlists
11. [ ] Availability checks without enumeration
12. [ ] Input validation
13. [ ] Versioned terms/privacy consent
14. [ ] Age and parental consent
15. [ ] Welcome and onboarding

## B. Verification

16. [ ] Email verification
17. [ ] Resend verification
18. [ ] Single-use expiring links
19. [ ] Phone SMS OTP
20. [ ] Disposable email blocking
21. [ ] Duplicate account prevention
22. [ ] CAPTCHA
23. [ ] Optional KYC
24. [ ] Domain restrictions

## C. Login

25. [ ] Email/password login
26. [ ] Username phone social magic link passkey login
27. [ ] Generic credential errors
28. [ ] Remember me
29. [ ] Safe redirects
30. [ ] Protected pages
31. [ ] QR login
32. [ ] OIDC/SAML SSO
33. [ ] Entra ID and LDAP integration

## D. Sessions

34. [ ] Session records
35. [ ] JWT access tokens
36. [ ] Access and refresh tokens
37. [ ] Refresh flow
38. [ ] Absolute and idle expiry
39. [ ] Secure HttpOnly SameSite cookies
40. [ ] HTTPS
41. [ ] CSRF
42. [ ] XSS
43. [ ] Session fixation prevention
44. [ ] Logout
45. [ ] Global logout
46. [ ] Device inventory and revocation
47. [ ] Trusted devices
48. [ ] Concurrent session caps
49. [ ] Mobile Keychain/Keystore
50. [ ] Multi-tab sync

## E. Passwords

51. [ ] Password rules
52. [ ] Strength meter
53. [ ] Show/hide password
54. [ ] Password manager support
55. [ ] One-way password hashing
56. [ ] Password salting
57. [ ] Leaked password checks
58. [ ] Forgot password
59. [ ] Expiring reset links
60. [ ] Current-password change
61. [ ] Password history
62. [ ] Optional enterprise password expiry

## F. MFA

63. [ ] SMS MFA
64. [ ] Email MFA
65. [ ] TOTP
66. [ ] Push approval
67. [ ] Hardware security keys
68. [ ] Backup codes
69. [ ] MFA enrollment/removal
70. [ ] Lost factor recovery
71. [ ] Step-up authentication
72. [ ] Reauthentication

## G. Attack protection

73. [ ] Rate limits
74. [ ] Account lockout
75. [ ] Brute-force protection
76. [ ] Credential stuffing protection
77. [ ] Suspicious login detection
78. [ ] IP restrictions
79. [ ] Bot detection
80. [ ] Breach monitoring
81. [ ] Security headers
82. [ ] Injection protection
83. [ ] One-time code/link security
84. [ ] Secret management and rotation

## H. Notifications

85. [ ] Security alerts by email
86. [ ] Login history
87. [ ] Audit logs
88. [ ] SPF DKIM DMARC
89. [ ] Email templates
90. [ ] Optional SMS provider

## I. Account management

91. [ ] Profile editing
92. [ ] Change email with confirmation
93. [ ] Change phone with verification
94. [ ] Change username
95. [ ] Recovery contacts
96. [ ] Connected accounts
97. [ ] Communication preferences
98. [ ] Deactivate account
99. [ ] Reactivate account
100. [ ] Permanent deletion
101. [ ] Support-assisted recovery

## J. Admin

102. [ ] Account states
103. [ ] User search
104. [ ] Suspend/ban
105. [ ] Admin deletion
106. [ ] Force reset/logout
107. [ ] Audited constrained support impersonation
108. [ ] Bulk migration
109. [ ] Soft/hard deletion

## K. Linking and groups

110. [ ] Account linking
111. [ ] Safe unlinking
112. [ ] Organisations and teams
113. [ ] Team invites
114. [ ] Domain joining
115. [ ] SCIM provisioning
116. [ ] Tenant isolation
117. [ ] Account switching

## L. Legal/privacy

118. [ ] Consent records
119. [ ] Terms reacceptance
120. [ ] Nonessential cookie consent
121. [ ] Data export
122. [ ] Erasure
123. [ ] Retention
124. [ ] Child protection
125. [ ] Accessibility

## M. Infrastructure

126. [ ] User database
127. [ ] Redirect allowlist
128. [ ] Environment separation
129. [ ] Errors/loading
130. [ ] Flow regression tests
131. [ ] Monitoring/alerts
132. [ ] Provider selection

## N. Related

133. [ ] Authorization and permissions
134. [ ] API keys and service accounts
135. [ ] Subscription entitlements
