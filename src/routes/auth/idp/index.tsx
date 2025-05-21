import { useParams, useSearchParams } from "@solidjs/router"


export default function Login() {
    const [params] = useSearchParams();

    return <div>
        <h1>Login</h1>

        <form method="post" action="/auth/idp/api/login">
            <label>username: <input type="text" name="username" value={params.login_hint} /></label>
            <label>password: <input type="password" name="password" value="test" /></label>

            <button type="submit">Submit</button>
        </form>
    </div>
}