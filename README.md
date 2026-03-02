# Bachelor Thesis – Comparison Portal for Crowdfunding Platforms

## Thema der Arbeit
This project was developed as part of a Bachelor's Thesis.
The objective is to design and implement a web-based comparison portal that supports users in identifying the most suitable crowdfunding provider based on individually defined criteria.

The system applies a weighted utility analysis model to evaluate and rank providers.


## Running the Application Locally
1. Clone the repository: 
   git clone https://github.com/TamStefBFH/bachelor-thesis-comparison-portal.git 
   cd bachelor-thesis-comparison-portal
2. Install dependencies: npm install
3. Create environment variables: Create a .env.local file based on .env.example and insert the required Supabase credentials.
   -> Credentials: Supabase credentials are not included in this repository for security reasons. If access is required for evaluation purposes, credentials can be provided upon request.
4. Start development server: npm run dev
5. The application will be available at: http://localhost:3000

Security Note
All environment variables and credentials are excluded from version control via .gitignore.
This ensures secure handling of API keys and database access information.