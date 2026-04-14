# # **EVENT CATALOG SERVICE UPDATE**
## **Date: Apr 12**
## **Service URL: http://localhost:3006**

---

## **SUMMARY**
Today I worked on the **Event Catalog Service** and completed the core setup needed to run it inside the team Docker environment. This included updating the **root `compose.yaml`**, configuring the **event-catalog database service**, updating the **Dockerfile**, and modifying **`service.js`** so the service can connect to both **PostgreSQL** and **Redis**.

---

## **COMPLETED TODAY**

### **1. Updated Root `compose.yaml`**
- Added and configured the **`event-catalog` service**
- Added and configured the **`event-catalog` database**
- Set up the required environment variables for:
  - **PostgreSQL**
  - **Redis**
- Configured the service so it can run through Docker and be reached at:
  - **`http://localhost:3006`**

### **2. Updated `Dockerfile`**
- Updated the **Dockerfile** for the event-catalog service
- Ensured the container builds correctly in the project environment

### **3. Updated `service.js`**
- Added connection logic for the **PostgreSQL database**
- Added connection logic for **Redis**
- Verified that the service is wired to both dependencies

### **4. Implemented `/health` Checkpoint**
- Added a **`/health`** endpoint
- This endpoint checks whether the service can successfully reach:
  - **PostgreSQL**
  - **Redis**
- This helps confirm whether the service is actually healthy, not just running

### **5. Implemented Mock `GET /events` Checkpoint**
- Added a mock **`GET /events`** endpoint
- This endpoint currently returns an **array of event objects**
- It serves as an initial checkpoint for the event listing functionality

---

## **CURRENT ENDPOINTS**

### **`GET /health`**
Checks service health and dependency connectivity.

### **`GET /events`**
Returns a mock array of event objects.

---

## **RUNNING SERVICE**
### **Local URL**
**http://localhost:3006**

---

## **NOTES**
The service is now able to:
- run through Docker
- connect to **PostgreSQL**
- connect to **Redis**
- expose a **health check endpoint**
- return mock event data through **`/events`**

This sets up the base needed for future work on:
- real event retrieval from the database
- venue and date handling
- seat map support
- caching popular event details in Redis