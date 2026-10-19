using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Security.Cryptography;

[DataContract]
sealed class Plan {
    [DataMember(Name="pid")] public int Pid;
    [DataMember(Name="attempt")] public string Attempt;
    [DataMember(Name="installer")] public string Installer;
    [DataMember(Name="sha256")] public string Hash;
    [DataMember(Name="size")] public long Size;
    [DataMember(Name="asarSHA256")] public string AsarHash;
    [DataMember(Name="updaterSHA256")] public string UpdaterHash;
    [DataMember(Name="version")] public string Version;
    [DataMember(Name="directory")] public string Directory;
    [DataMember(Name="executable")] public string Executable;
    [DataMember(Name="ready")] public string Ready;
    [DataMember(Name="result")] public string Result;
}
[DataContract]
sealed class Ready {
    [DataMember(Name="phase")] public string Phase="started";
    [DataMember(Name="attempt")] public string Attempt;
    [DataMember(Name="version")] public string Version;
}
[DataContract]
sealed class Result {
    [DataMember(Name="success")] public bool Success;
    [DataMember(Name="attempt")] public string Attempt;
    [DataMember(Name="version")] public string Version;
    [DataMember(Name="error")] public string Error;
    [DataMember(Name="finishedAt")] public string FinishedAt=DateTime.UtcNow.ToString("o");
}
static class Program {
    static string Hash(string file) {
        using(var stream=File.OpenRead(file))
        using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
    }
    static void Write(string file,object value) {
        var temporary=file+"."+Guid.NewGuid().ToString("N")+".tmp";
        using(var stream=File.Create(temporary))new DataContractJsonSerializer(value.GetType()).WriteObject(stream,value);
        if(File.Exists(file))File.Delete(file);
        File.Move(temporary,file);
    }
    static bool Alive(int pid) {
        try{using(var process=Process.GetProcessById(pid))return !process.HasExited;}
        catch(ArgumentException){return false;}
    }
    static void WaitForParent(int pid) {
        try{using(var parent=Process.GetProcessById(pid))if(!parent.WaitForExit(60000))throw new IOException("The launcher did not close. Close it and retry the update.");}
        catch(ArgumentException){} // The parent may have exited before its handle opened.
        catch(InvalidOperationException){if(Alive(pid))throw;}
    }
    static void Launch(Plan plan,string argument) {
        if(File.Exists(plan.Executable))Process.Start(new ProcessStartInfo(plan.Executable,argument){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,WorkingDirectory=plan.Directory});
    }
    [STAThread]
    static int Main(string[] args) {
        Plan plan=null;Process installer=null;
        try {
            if(args.Length!=2||args[0]!="--plan")return 2;
            using(var stream=File.OpenRead(args[1]))plan=(Plan)new DataContractJsonSerializer(typeof(Plan)).ReadObject(stream);
            if(plan.Pid<=0||plan.Pid==Process.GetCurrentProcess().Id||String.IsNullOrEmpty(plan.Installer)||String.IsNullOrEmpty(plan.Ready)||String.IsNullOrEmpty(plan.Result))throw new IOException("Invalid updater plan");
            Write(plan.Ready,new Ready{Attempt=plan.Attempt,Version=plan.Version});
            WaitForParent(plan.Pid);
            if(new FileInfo(plan.Installer).Length!=plan.Size||!String.Equals(Hash(plan.Installer),plan.Hash,StringComparison.OrdinalIgnoreCase))throw new IOException("Update integrity verification failed");
            // NSIS requires /D last, with its directory unquoted even when it has spaces.
            installer=Process.Start(new ProcessStartInfo(plan.Installer,"/S --updated /D="+plan.Directory){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});
            if(!installer.WaitForExit(180000))throw new IOException("The installer is still running. Wait for it to finish before retrying.");
            if(installer.ExitCode!=0)throw new IOException("Installer exited with code "+installer.ExitCode);
            if(!String.IsNullOrEmpty(plan.AsarHash)&&!String.Equals(Hash(Path.Combine(plan.Directory,"resources","app.asar")),plan.AsarHash,StringComparison.OrdinalIgnoreCase))throw new IOException("The installed launcher did not match the verified release.");
            if(!String.IsNullOrEmpty(plan.UpdaterHash)&&!String.Equals(Hash(Path.Combine(plan.Directory,"resources","updater","BlueCloudUpdate.exe")),plan.UpdaterHash,StringComparison.OrdinalIgnoreCase))throw new IOException("The installed update helper did not match the verified release.");
            Write(plan.Result,new Result{Success=true,Attempt=plan.Attempt,Version=plan.Version});
            Launch(plan,"--updated");return 0;
        } catch(Exception error) {
            if(plan!=null){
                try{Write(plan.Result,new Result{Success=false,Attempt=plan.Attempt,Version=plan.Version,Error=error.Message});}catch{}
                // Never reopen the app while an installer is still changing its files.
                try{if(!Alive(plan.Pid)&&(installer==null||installer.HasExited))Launch(plan,"--update-failed");}catch{}
            }
            return 1;
        } finally{if(installer!=null)installer.Dispose();}
    }
}
