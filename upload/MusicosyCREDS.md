Musicosy

GitHub Repo: https://github.com/musixkube-cmyk/devportal.git

Github\_Access\_token=ghp\_dDdgt1nWTJ1G4E07jjKu4AEPQ9MWjq2cAHoR



\#SUPABASE



NEXT\_PUBLIC\_SUPABASE\_SUPABASE\_ANON=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdmpkeGVyanR0amhyenlndHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjM0NzYsImV4cCI6MjEwMDk5OTQ3Nn0.G4m7G8hEGCUiLj--oLVH6jDzGUG9LEXstfEk8uoVMM8





NEXT\_PUBLIC\_SUPABASE\_SUPABASE\_SERVICE\_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdmpkeGVyanR0amhyenlndHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjM0NzYsImV4cCI6MjEwMDk5OTQ3Nn0.G4m7G8hEGCUiLj--oLVH6jDzGUG9LEXstfEk8uoVMM8





NEXT\_PUBLIC\_SUPABASE\_SUPABASE\_DIRECT\_CONNECTION\_STRING=postgresql://postgres:Bavin1863!!@db.kcvjdxerjttjhrzygtrp.supabase.co:5432/postgres



NEXT\_PUBLIC\_SUPABASE\_URL=https://kcvjdxerjttjhrzygtrp.supabase.co



NEXT\_PUBLIC\_SUPABASE\_PUBLISHABLE\_KEY=sb\_publishable\_8JtRsAe8ACCVLS3r\_aShkw\_XN6C\_x8H



NEXT\_PUBLIC\_SUPABASE\_SUPABASE\_ACCESS\_TOKEN=sbp\_d6b0269c8afdc7d8632a85f2e995d36b8cd120af



ORM SUPABASE



**1. Install ORM**

**Add the ORM to your project.**

**Code:**

**File: Code**

**```**

**npm install prisma --save-dev**

**```**



**File: Code**

**```**

**npx prisma init**

**```**



**2. Configure ORM**

**Set up your ORM configuration.**

**Code:**

**File: .env.local**

**```**

**# Connect to Postgres via the shared transaction-mode pooler (IPv4-only)**

**DATABASE\_URL="postgresql://postgres.kcvjdxerjttjhrzygtrp:\[YOUR-PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true"**



**# Connect to Postgres via the shared session-mode pooler (used for migrations)**

**DIRECT\_URL="postgresql://postgres.kcvjdxerjttjhrzygtrp:\[YOUR-PASSWORD]@aws-0-us-east-2.pooler.supabase.com:5432/postgres"**

**```**



**File: prisma/schema.prisma**

**```**

**generator client {**

&#x20; **provider = "prisma-client-js"**

**}**



**datasource db {**

&#x20; **provider  = "postgresql"**

&#x20; **url       = env("DATABASE\_URL")**

&#x20; **directUrl = env("DIRECT\_URL")**

**}**

**```**



**3. Install Agent Skills (optional)**

**Agent Skills give AI coding tools ready-made instructions, scripts, and resources for working with Supabase more accurately and efficiently.**

**Code:**

**File: Code**

**```**

**npx skills add supabase/agent-skills**

**```**

