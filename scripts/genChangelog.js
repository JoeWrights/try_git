const execa = require("execa")
const cc = require("conventional-changelog")

const CWD = process.cwd()
const changeLogPath = `${CWD}/CHANGELOG.md`

module.exports = (version) => {
    const fileStream = require("fs").createWriteStream(changeLogPath)

    cc({
        preset: "angular",
        releaseCount: 0,
        pkg: {
            transform(pkg) {
                pkg.version = `v${version}`
                return pkg
            },
        },
    })
        .pipe(fileStream)
        .on("close", async () => {
            await execa("git", ["add", "-A"], { stdio: "inherit" })
            await execa(
                "git",
                ["commit", "-m", `chore: ${version} changelog [ci skip]`],
                { stdio: "inherit" },
            )
            const { stdout } = execa.commandSync("git rev-parse --abbrev-ref HEAD")
            console.log(stdout, "stdout")
            await execa("git", ["push"], { stdio: "inherit" })
            await execa("git", ["tag", "-a", `${version}`, "-m", `${version}`], { stdio: "inherit" })
            await execa("git", ["push", "origin", `${version}`], { stdio: "inherit" })
        })
}
